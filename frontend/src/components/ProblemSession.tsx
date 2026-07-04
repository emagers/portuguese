import { useState } from "react";
import type { Problem } from "../types";
import ProblemCard from "./ProblemCard";

// Steps through a list of generated problems, tracks the score, and shows a
// summary at the end. Reused by reinforcement sessions and knowledge tests.
export default function ProblemSession({
  problems,
  onRestart,
  onComplete,
  restartLabel = "New session",
}: {
  problems: Problem[];
  onRestart?: () => void;
  onComplete?: () => void;
  restartLabel?: string;
}) {
  const [i, setI] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [answeredThis, setAnsweredThis] = useState(false);
  const [done, setDone] = useState(false);

  const problem = problems[i];
  const isLast = i === problems.length - 1;

  const onAnswered = (ok: boolean) => {
    if (answeredThis) return;
    setAnsweredThis(true);
    if (ok) setCorrect((c) => c + 1);
  };

  const next = () => {
    if (isLast) {
      setDone(true);
      onComplete?.();
    } else {
      setI((n) => n + 1);
      setAnsweredThis(false);
    }
  };

  const restart = () => {
    setI(0);
    setCorrect(0);
    setAnsweredThis(false);
    setDone(false);
    onRestart?.();
  };

  if (problems.length === 0) {
    return <div className="empty">No problems to practise right now.</div>;
  }

  if (done) {
    const pct = Math.round((correct / problems.length) * 100);
    return (
      <div className="card center">
        <div className="score-big" style={{ color: pct >= 60 ? "var(--ok)" : "var(--warn)" }}>
          {pct}%
        </div>
        <p className="muted">
          {correct} / {problems.length} correct
        </p>
        <div className="row center mt">
          {onRestart && (
            <button className="btn green" onClick={restart}>
              {restartLabel}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row spread small muted">
        <span>
          {i + 1} / {problems.length}
        </span>
        <span>{correct} correct</span>
      </div>
      <div className="progress mt" style={{ marginBottom: 14 }}>
        <span style={{ width: `${((i + 1) / problems.length) * 100}%` }} />
      </div>

      <ProblemCard key={problem.id} problem={problem} onAnswered={onAnswered} />

      <div className="row mt">
        <button className="btn" onClick={next} disabled={!answeredThis}>
          {isLast ? "See results" : "Next →"}
        </button>
        {!answeredThis && problem.kind === "pronounce" && (
          <button className="btn ghost" onClick={next}>
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
