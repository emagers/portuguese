import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { speak } from "../api/audio";
import type { Quiz } from "../types";
import { LevelBadge, Loading, SpeakButton } from "../components/common";

export default function QuizPage() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.quiz(id).then(setQuiz).catch(() => setQuiz(null));
  }, [id]);

  if (!quiz) return <Loading what="quiz" />;

  const q = quiz.questions[i];
  const isLast = i === quiz.questions.length - 1;

  const check = () => {
    if (selected === null) return;
    if (selected === q.answer) setCorrect((c) => c + 1);
    setChecked(true);
  };

  const next = () => {
    if (isLast) {
      const finalScore = correct;
      api.saveQuiz(quiz.id, quiz.level, finalScore, quiz.questions.length).catch(() => {});
      setFinished(true);
    } else {
      setI((n) => n + 1);
      setSelected(null);
      setChecked(false);
    }
  };

  const restart = () => {
    setI(0);
    setSelected(null);
    setChecked(false);
    setCorrect(0);
    setFinished(false);
  };

  if (finished) {
    const pct = Math.round((correct / quiz.questions.length) * 100);
    return (
      <div>
        <Link to="/quizzes" className="small">← All tests</Link>
        <div className="card center mt-lg">
          <h1>{quiz.title}</h1>
          <div className="score-big" style={{ color: pct >= 60 ? "var(--ok)" : "var(--err)" }}>
            {pct}%
          </div>
          <p className="muted">
            {correct} / {quiz.questions.length} correct
          </p>
          <div className="row center mt">
            <button className="btn" onClick={restart}>Try again</button>
            <Link className="btn ghost" to="/quizzes">Back to tests</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/quizzes" className="small">← All tests</Link>
      <div className="page-head mt">
        <div>
          <LevelBadge level={quiz.level} />
          <h1 style={{ marginTop: 8 }}>{quiz.title}</h1>
        </div>
        <span className="muted">
          Question {i + 1} / {quiz.questions.length}
        </span>
      </div>
      <div className="progress">
        <span style={{ width: `${((i + 1) / quiz.questions.length) * 100}%` }} />
      </div>

      <div className="card mt">
        {q.type === "listening" ? (
          <div className="center stack">
            <p className="muted">{q.prompt}</p>
            <button className="btn big" onClick={() => speak(q.audioText || "")}>
              🔊 Play audio
            </button>
          </div>
        ) : (
          <h2>
            {q.prompt}{" "}
            {q.type === "translate_pt_en" && <SpeakButton text={q.prompt} />}
          </h2>
        )}
        {q.promptPt && q.type !== "listening" && (
          <p className="muted">{q.promptPt}</p>
        )}

        <div className="mt">
          {q.options.map((opt) => {
            let cls = "option";
            if (selected === opt) cls += " selected";
            if (checked) {
              if (opt === q.answer) cls += " correct";
              else if (selected === opt) cls += " wrong";
            }
            const isPt =
              q.type === "fill_blank" ||
              q.type === "translate_en_pt" ||
              q.type === "listening" ||
              q.type === "multiple_choice";
            return (
              <button
                key={opt}
                className={cls}
                onClick={() => !checked && setSelected(opt)}
              >
                {opt} {checked && isPt && <SpeakButton text={opt} />}
              </button>
            );
          })}
        </div>

        {checked && (
          <div className={`banner ${selected === q.answer ? "" : "err"} mt`}>
            {selected === q.answer ? "✅ Correct!" : `❌ Correct answer: ${q.answer}`}
            {q.explanation && <div className="small mt">💡 {q.explanation}</div>}
          </div>
        )}

        <div className="row mt">
          {!checked ? (
            <button className="btn" onClick={check} disabled={selected === null}>
              Check
            </button>
          ) : (
            <button className="btn green" onClick={next}>
              {isLast ? "See results" : "Next question →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
