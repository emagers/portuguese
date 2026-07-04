import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { GrammarLesson } from "../types";
import { LevelBadge, Loading, SpeakButton } from "../components/common";
import Markdown from "../components/Markdown";

export default function GrammarLessonPage() {
  const { id } = useParams();
  const [lesson, setLesson] = useState<GrammarLesson | null>(null);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLesson(null);
    api.grammar(id).then(setLesson).catch((e) => setErr(String(e)));
  }, [id]);

  if (err) return <div className="banner err">Lesson not found: {err}</div>;
  if (!lesson) return <Loading what="lesson" />;

  const markDone = () => {
    api.markLesson(lesson.id).then(() => setDone(true)).catch(() => setDone(true));
  };

  return (
    <article>
      <Link to="/grammar" className="small">← All grammar</Link>
      <div className="row spread mt">
        <div>
          <LevelBadge level={lesson.level} />
          <h1 style={{ marginTop: 8 }}>{lesson.title}</h1>
          {lesson.titlePt && (
            <p className="muted" style={{ marginTop: -6 }}>
              {lesson.titlePt} <SpeakButton text={lesson.titlePt} />
            </p>
          )}
        </div>
      </div>
      <p>{lesson.summary}</p>

      {lesson.sections.map((s, i) => (
        <section key={i} className="mt-lg">
          <h2>{s.heading}</h2>
          <Markdown text={s.body} />
          {s.examples.map((ex, j) => (
            <div key={j} className="example">
              <div className="pt">
                {ex.pt} <SpeakButton text={ex.pt} />
              </div>
              <div className="en">{ex.en}</div>
              {ex.note && <div className="note">💡 {ex.note}</div>}
            </div>
          ))}
        </section>
      ))}

      {lesson.keyPoints.length > 0 && (
        <section className="mt-lg">
          <h2>Key points</h2>
          <div className="stack">
            {lesson.keyPoints.map((k, i) => (
              <div key={i} className="keypoint">✔️ {k}</div>
            ))}
          </div>
        </section>
      )}

      {lesson.commonMistakes.length > 0 && (
        <section className="mt-lg">
          <h2>Common mistakes</h2>
          <div className="stack">
            {lesson.commonMistakes.map((m, i) => (
              <div key={i} className="mistake">
                <div>
                  <span className="wrong">{m.wrong}</span> →{" "}
                  <span className="right">{m.right}</span>{" "}
                  <SpeakButton text={m.right} />
                </div>
                {m.note && <div className="small muted">{m.note}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="row mt-lg">
        {lesson.quizId && (
          <Link className="btn" to={`/quizzes/${lesson.quizId}`}>
            Take the quiz →
          </Link>
        )}
        {lesson.relatedVocab.map((v) => (
          <Link key={v} className="btn ghost" to={`/vocab/${v}`}>
            🗂️ Related vocabulary
          </Link>
        ))}
        <button className={`btn green`} onClick={markDone} disabled={done}>
          {done ? "✓ Marked complete" : "Mark as complete"}
        </button>
      </div>
    </article>
  );
}
