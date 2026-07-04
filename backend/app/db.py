"""SQLite persistence for learner progress.

Uses the standard-library ``sqlite3`` module (no extra dependency). Tracks:
  * vocabulary spaced-repetition state (SM-2 algorithm)
  * quiz results and history
  * grammar lesson completion
  * pronunciation attempt history
  * a daily activity log for streaks
"""
from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from datetime import date, datetime, timezone
from typing import Iterator, Optional

from .config import settings

_local = threading.local()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_conn() -> Iterator[sqlite3.Connection]:
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(settings.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        _local.conn = conn
    yield conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS vocab_srs (
                card_id     TEXT PRIMARY KEY,
                deck_id     TEXT NOT NULL,
                ease        REAL NOT NULL DEFAULT 2.5,
                interval    INTEGER NOT NULL DEFAULT 0,
                reps        INTEGER NOT NULL DEFAULT 0,
                lapses      INTEGER NOT NULL DEFAULT 0,
                due         TEXT NOT NULL,
                last_review TEXT
            );

            CREATE TABLE IF NOT EXISTS quiz_results (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                quiz_id   TEXT NOT NULL,
                level     TEXT,
                score     INTEGER NOT NULL,
                total     INTEGER NOT NULL,
                details   TEXT,
                taken_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS lesson_progress (
                lesson_id  TEXT PRIMARY KEY,
                status     TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS deck_progress (
                deck_id    TEXT PRIMARY KEY,
                status     TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS phrase_progress (
                collection_id TEXT PRIMARY KEY,
                status        TEXT NOT NULL,
                updated_at    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS pronunciation_attempts (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                phrase     TEXT NOT NULL,
                score      REAL NOT NULL,
                transcript TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                day        TEXT PRIMARY KEY,
                events     INTEGER NOT NULL DEFAULT 0
            );
            """
        )
        conn.commit()


def log_activity() -> None:
    today = date.today().isoformat()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO activity_log(day, events) VALUES(?, 1) "
            "ON CONFLICT(day) DO UPDATE SET events = events + 1",
            (today,),
        )
        conn.commit()


# --------------------------------------------------------------------------- #
# Vocabulary spaced repetition (SM-2)
# --------------------------------------------------------------------------- #
def _sm2(row: Optional[sqlite3.Row], grade: int) -> dict:
    """Compute next SM-2 state. ``grade`` is 0-5 (0 = total blackout, 5 = perfect)."""
    ease = row["ease"] if row else 2.5
    interval = row["interval"] if row else 0
    reps = row["reps"] if row else 0
    lapses = row["lapses"] if row else 0

    if grade < 3:
        reps = 0
        interval = 1
        lapses += 1
    else:
        reps += 1
        if reps == 1:
            interval = 1
        elif reps == 2:
            interval = 6
        else:
            interval = round(interval * ease)
        ease = ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
        ease = max(1.3, ease)
    return {"ease": ease, "interval": max(1, interval), "reps": reps, "lapses": lapses}


def review_card(card_id: str, deck_id: str, grade: int) -> dict:
    from datetime import timedelta

    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM vocab_srs WHERE card_id = ?", (card_id,)
        ).fetchone()
        state = _sm2(row, grade)
        due = (datetime.now(timezone.utc) + timedelta(days=state["interval"])).isoformat()
        conn.execute(
            """INSERT INTO vocab_srs(card_id, deck_id, ease, interval, reps, lapses, due, last_review)
               VALUES(?,?,?,?,?,?,?,?)
               ON CONFLICT(card_id) DO UPDATE SET
                 deck_id=excluded.deck_id, ease=excluded.ease, interval=excluded.interval,
                 reps=excluded.reps, lapses=excluded.lapses, due=excluded.due,
                 last_review=excluded.last_review""",
            (
                card_id,
                deck_id,
                state["ease"],
                state["interval"],
                state["reps"],
                state["lapses"],
                due,
                _now(),
            ),
        )
        conn.commit()
    log_activity()
    return {"card_id": card_id, "due": due, **state}


def due_cards(deck_id: Optional[str] = None) -> list[str]:
    now = _now()
    with get_conn() as conn:
        if deck_id:
            rows = conn.execute(
                "SELECT card_id FROM vocab_srs WHERE deck_id=? AND due<=?",
                (deck_id, now),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT card_id FROM vocab_srs WHERE due<=?", (now,)
            ).fetchall()
    return [r["card_id"] for r in rows]


def vocab_stats() -> dict:
    now = _now()
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) c FROM vocab_srs").fetchone()["c"]
        due = conn.execute(
            "SELECT COUNT(*) c FROM vocab_srs WHERE due<=?", (now,)
        ).fetchone()["c"]
        learned = conn.execute(
            "SELECT COUNT(*) c FROM vocab_srs WHERE reps>=2"
        ).fetchone()["c"]
    return {"tracked": total, "due": due, "learned": learned}


# --------------------------------------------------------------------------- #
# Quizzes
# --------------------------------------------------------------------------- #
def save_quiz_result(quiz_id: str, level: Optional[str], score: int, total: int, details: str) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO quiz_results(quiz_id, level, score, total, details, taken_at) VALUES(?,?,?,?,?,?)",
            (quiz_id, level, score, total, details, _now()),
        )
        conn.commit()
    log_activity()
    return cur.lastrowid


def quiz_history(limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, quiz_id, level, score, total, taken_at FROM quiz_results "
            "ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


# --------------------------------------------------------------------------- #
# Lessons
# --------------------------------------------------------------------------- #
def set_lesson_status(lesson_id: str, status: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO lesson_progress(lesson_id, status, updated_at) VALUES(?,?,?) "
            "ON CONFLICT(lesson_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at",
            (lesson_id, status, _now()),
        )
        conn.commit()
    log_activity()


def lesson_statuses() -> dict:
    with get_conn() as conn:
        rows = conn.execute("SELECT lesson_id, status FROM lesson_progress").fetchall()
    return {r["lesson_id"]: r["status"] for r in rows}


# --------------------------------------------------------------------------- #
# Vocabulary deck completion
# --------------------------------------------------------------------------- #
def set_deck_status(deck_id: str, status: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO deck_progress(deck_id, status, updated_at) VALUES(?,?,?) "
            "ON CONFLICT(deck_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at",
            (deck_id, status, _now()),
        )
        conn.commit()
    log_activity()


def deck_statuses() -> dict:
    with get_conn() as conn:
        rows = conn.execute("SELECT deck_id, status FROM deck_progress").fetchall()
    return {r["deck_id"]: r["status"] for r in rows}


# --------------------------------------------------------------------------- #
# Phrase collection completion
# --------------------------------------------------------------------------- #
def set_phrase_status(collection_id: str, status: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO phrase_progress(collection_id, status, updated_at) VALUES(?,?,?) "
            "ON CONFLICT(collection_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at",
            (collection_id, status, _now()),
        )
        conn.commit()
    log_activity()


def phrase_statuses() -> dict:
    with get_conn() as conn:
        rows = conn.execute("SELECT collection_id, status FROM phrase_progress").fetchall()
    return {r["collection_id"]: r["status"] for r in rows}


def completed_deck_ids() -> list[str]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT deck_id FROM deck_progress WHERE status = 'completed'"
        ).fetchall()
    return [r["deck_id"] for r in rows]


def completed_phrase_ids() -> list[str]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT collection_id FROM phrase_progress WHERE status = 'completed'"
        ).fetchall()
    return [r["collection_id"] for r in rows]


# --------------------------------------------------------------------------- #
# Pronunciation
# --------------------------------------------------------------------------- #
def save_pronunciation(phrase: str, score: float, transcript: str) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO pronunciation_attempts(phrase, score, transcript, created_at) VALUES(?,?,?,?)",
            (phrase, score, transcript, _now()),
        )
        conn.commit()
    log_activity()


def pronunciation_history(limit: int = 50) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT phrase, score, transcript, created_at FROM pronunciation_attempts "
            "ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


# --------------------------------------------------------------------------- #
# Overall summary + streak
# --------------------------------------------------------------------------- #
def activity_summary() -> dict:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT day FROM activity_log ORDER BY day DESC"
        ).fetchall()
    days = [r["day"] for r in rows]
    streak = 0
    from datetime import timedelta

    cursor = date.today()
    day_set = set(days)
    while cursor.isoformat() in day_set:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return {"active_days": len(days), "streak": streak}
