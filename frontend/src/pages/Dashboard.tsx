import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { LevelInfo, SystemStatus } from "../types";
import { Loading } from "../components/common";

export default function Dashboard() {
  const [levels, setLevels] = useState<LevelInfo[] | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    api.levels().then(setLevels).catch(() => setLevels([]));
    api.systemStatus().then(setStatus).catch(() => {});
    api.progressSummary().then(setProgress).catch(() => {});
  }, []);

  if (!levels) return <Loading what="dashboard" />;

  const totals = levels.reduce(
    (a, l) => ({
      grammar: a.grammar + l.grammar,
      vocab: a.vocab + l.vocab,
      stories: a.stories + l.stories,
      quizzes: a.quizzes + l.quizzes,
    }),
    { grammar: 0, vocab: 0, stories: 0, quizzes: 0 },
  );

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Bem-vindo! 👋</h1>
          <p className="muted">
            Your offline Brazilian Portuguese tutor — grammar, vocabulary,
            reading, listening and pronunciation, all running locally.
          </p>
        </div>
      </div>

      {status && (!status.tts.available || !status.asr.available) && (
        <div className="banner">
          <strong>Optional setup:</strong>{" "}
          {!status.asr.available && (
            <span>
              Pronunciation scoring needs the speech model —{" "}
              <code>run scripts/setup.ps1</code>.{" "}
            </span>
          )}
          {!status.tts.available && (
            <span>
              High-quality voice needs Piper (<code>python scripts/download_models.py</code>);
              meanwhile audio uses your browser's built-in Portuguese voice.
            </span>
          )}
        </div>
      )}

      {progress && (
        <div className="grid mt" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
          <div className="card center">
            <div className="score-big">{progress.activity?.streak ?? 0}</div>
            <div className="muted">day streak 🔥</div>
          </div>
          <div className="card center">
            <div className="score-big">{progress.vocab?.due ?? 0}</div>
            <div className="muted">words due for review</div>
          </div>
          <div className="card center">
            <div className="score-big">{progress.vocab?.learned ?? 0}</div>
            <div className="muted">words learned</div>
          </div>
          <div className="card center">
            <div className="score-big">{progress.recent_quizzes?.length ?? 0}</div>
            <div className="muted">quizzes taken</div>
          </div>
        </div>
      )}

      <h2 className="mt-lg">Your curriculum</h2>
      <p className="muted small">
        {totals.grammar} grammar lessons · {totals.vocab} vocab decks ·{" "}
        {totals.stories} stories & dialogues · {totals.quizzes} tests
      </p>
      <div className="grid mt">
        {levels.map((l) => (
          <div key={l.level} className="card">
            <div className="row spread">
              <h3>
                <span className="badge blue">{l.level}</span> {l.name}
              </h3>
            </div>
            <div className="stack mt">
              <Link to={`/grammar?level=${l.level}`}>📖 {l.grammar} grammar lessons</Link>
              <Link to={`/vocab?level=${l.level}`}>🗂️ {l.vocab} vocabulary decks</Link>
              <Link to={`/stories?level=${l.level}`}>💬 {l.stories} stories & dialogues</Link>
              <Link to={`/quizzes?level=${l.level}`}>✅ {l.quizzes} knowledge tests</Link>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-lg">Practice</h2>
      <div className="grid mt">
        <Link className="card link" to="/pronunciation">
          <h3>🎙️ Pronunciation coach</h3>
          <p className="sub">Record yourself and get a score plus sound-by-sound tips.</p>
        </Link>
        <Link className="card link" to="/listening">
          <h3>🎧 Listening practice</h3>
          <p className="sub">Train your ear with spoken phrases and dictation.</p>
        </Link>
      </div>
    </div>
  );
}
