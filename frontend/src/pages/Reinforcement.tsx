import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Problem, ReinforcementStatus } from "../types";
import { Loading } from "../components/common";
import ProblemSession from "../components/ProblemSession";

export default function Reinforcement() {
  const [status, setStatus] = useState<ReinforcementStatus | null>(null);
  const [scope, setScope] = useState("all");
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.reinforcementStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const start = async (chosenScope: string) => {
    setScope(chosenScope);
    setLoading(true);
    setError(null);
    setProblems(null);
    try {
      const res = await api.reinforcementSession(chosenScope, 14, true);
      setProblems(res.problems);
    } catch (e: any) {
      setError(e.message || "Could not build a session.");
    } finally {
      setLoading(false);
    }
  };

  if (!status) return <Loading what="reinforcement" />;

  if (problems) {
    return (
      <div>
        <button className="btn ghost" onClick={() => setProblems(null)}>← Back</button>
        <h1 className="mt">🔁 Reinforcement</h1>
        <ProblemSession
          problems={problems}
          restartLabel="New session"
          onRestart={() => start(scope)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🔁 Reinforcement</h1>
          <p className="muted">
            Mixed practice — pictures, listening, translation, fill-in-the-blank and
            pronunciation — drawn only from material you've completed. Every session
            is freshly randomized.
          </p>
        </div>
      </div>

      {error && <div className="banner err">⚠️ {error}</div>}

      {!status.ready ? (
        <div className="empty">
          <p>Nothing to reinforce yet. 🔒</p>
          <p className="small">
            Complete a <Link to="/vocab">vocabulary deck</Link> (or a{" "}
            <Link to="/pronunciation">phrase collection</Link>) to unlock reinforcement
            practice. Reinforcement only quizzes things you've already learned.
          </p>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="row spread">
              <div>
                <h3>Mixed review</h3>
                <p className="sub">
                  Draws from all {status.completed_decks.length} completed deck
                  {status.completed_decks.length === 1 ? "" : "s"} ({status.term_count} words).
                </p>
              </div>
              <button className="btn green big" onClick={() => start("all")} disabled={loading}>
                {loading && scope === "all" ? "Building…" : "Start ▶"}
              </button>
            </div>
          </div>

          <h2 className="mt-lg">By completed deck</h2>
          <div className="grid mt">
            {status.completed_decks.map((d) => (
              <div key={d.id} className="card">
                <div className="row spread">
                  <span className="badge blue">{d.level}</span>
                </div>
                <h3 className="mt">{d.title}</h3>
                <button
                  className="btn mt"
                  onClick={() => start(`deck:${d.id}`)}
                  disabled={loading}
                >
                  {loading && scope === `deck:${d.id}` ? "Building…" : "Reinforce ▶"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
