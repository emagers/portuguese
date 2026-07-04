import { useRef, useState } from "react";
import type { Assessment, Problem } from "../types";
import { Recorder, speak } from "../api/audio";
import { api } from "../api/client";
import Picture from "./Picture";
import { SpeakButton } from "./common";

// Renders one generated problem of any kind and reports the result once via
// onAnswered(correct). Used by both reinforcement sessions and knowledge tests.
export default function ProblemCard({
  problem,
  onAnswered,
}: {
  problem: Problem;
  onAnswered: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);

  // pronunciation state
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [pronErr, setPronErr] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);

  const p = problem;

  const chooseMc = (opt: string) => {
    if (answered) return;
    setSelected(opt);
    setAnswered(true);
    onAnswered(opt === p.answer);
  };

  const startRec = async () => {
    setPronErr(null);
    try {
      recorderRef.current = new Recorder();
      await recorderRef.current.start();
      setRecording(true);
    } catch {
      setPronErr("Microphone unavailable.");
    }
  };
  const stopRec = async () => {
    if (!recorderRef.current) return;
    setRecording(false);
    setBusy(true);
    try {
      const blob = await recorderRef.current.stop();
      const res = await api.assess(p.target || p.prompt_text || "", blob);
      setAssessment(res);
      setAnswered(true);
      onAnswered(res.score >= 60);
    } catch (e: any) {
      setPronErr(e.message || "Assessment failed.");
    } finally {
      setBusy(false);
    }
  };

  const optClass = (opt: string) => {
    let c = "option";
    if (!answered) return c + (selected === opt ? " selected" : "");
    if (opt === p.answer) c += " correct";
    else if (opt === selected) c += " wrong";
    return c;
  };

  return (
    <div className="card">
      <div className="row spread">
        <span className="muted small">{p.instruction}</span>
      </div>

      {/* Prompt */}
      {p.kind === "picture_to_word" && p.prompt_emoji && (
        <div className="center" style={{ margin: "10px 0" }}>
          <Picture emoji={p.prompt_emoji} size={120} />
        </div>
      )}
      {(p.kind === "mc_text" || p.kind === "cloze") && p.prompt_text && (
        <h2 style={{ marginTop: 6 }}>
          {p.prompt_text}{" "}
          {p.kind === "cloze" && p.audio_text && <SpeakButton text={p.audio_text} />}
        </h2>
      )}
      {p.kind === "word_to_picture" && p.prompt_text && (
        <h2 style={{ marginTop: 6 }}>
          {p.prompt_text} {p.audio_text && <SpeakButton text={p.audio_text} />}
        </h2>
      )}
      {p.kind === "listening" && (
        <div className="center stack" style={{ margin: "8px 0" }}>
          <div className="row" style={{ justifyContent: "center" }}>
            <button className="btn big" onClick={() => speak(p.audio_text || "")}>🔊 Play</button>
            <button className="btn ghost" onClick={() => speak(p.audio_text || "", 0.7)}>🐢 Slow</button>
          </div>
        </div>
      )}

      {/* Options (MC / picture / listening / cloze) */}
      {p.kind !== "pronounce" && p.options && (
        <div className={p.options_are_emoji ? "row" : ""} style={p.options_are_emoji ? { flexWrap: "wrap", gap: 12 } : undefined}>
          {p.options.map((opt) =>
            p.options_are_emoji ? (
              <button
                key={opt}
                className={optClass(opt)}
                style={{ width: "auto", padding: 12 }}
                onClick={() => chooseMc(opt)}
              >
                <Picture emoji={opt} size={72} />
              </button>
            ) : (
              <button key={opt} className={optClass(opt)} onClick={() => chooseMc(opt)}>
                {opt}{" "}
                {answered && p.speak_options && opt === p.answer && <SpeakButton text={opt} />}
              </button>
            ),
          )}
        </div>
      )}

      {/* Pronunciation */}
      {p.kind === "pronounce" && (
        <div className="center stack">
          <h2>
            {p.target} <SpeakButton text={p.target || ""} />
          </h2>
          {!assessment && (
            <div className="row" style={{ justifyContent: "center" }}>
              <button className="btn ghost" onClick={() => speak(p.target || "", 0.7)}>🐢 Slow</button>
              {!recording ? (
                <button className="btn green big" onClick={startRec} disabled={busy}>
                  {busy ? "Analysing…" : "● Record"}
                </button>
              ) : (
                <button className="btn rec big" onClick={stopRec}>■ Stop & score</button>
              )}
            </div>
          )}
          {pronErr && <div className="banner err">⚠️ {pronErr}</div>}
          {assessment && (
            <div className="stack">
              <div className="score-big" style={{ color: assessment.score >= 60 ? "var(--ok)" : "var(--warn)" }}>
                {assessment.score}
              </div>
              <div className="muted">{assessment.verdict}</div>
              <div className="small muted">We heard: "{assessment.transcript || "—"}"</div>
              {assessment.tips?.length > 0 && (
                <div className="keypoint small">💡 {assessment.tips[0]}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reveal */}
      {answered && (
        <div className={`banner ${resolvedCorrect(p, selected, assessment) ? "" : "err"} mt`}>
          {p.kind === "pronounce" ? (
            assessment && assessment.score >= 60 ? "✅ Nicely done!" : "Keep practising this one."
          ) : resolvedCorrect(p, selected, assessment) ? (
            "✅ Correct!"
          ) : (
            <>❌ Answer: <strong>{p.answer}</strong></>
          )}
          {p.reveal_text && <div className="pt mt">{p.reveal_text}</div>}
          {p.translation && <div className="en">{p.translation}</div>}
          {p.explanation && <div className="small muted mt">💡 {p.explanation}</div>}
        </div>
      )}
    </div>
  );
}

function resolvedCorrect(p: Problem, selected: string | null, a: Assessment | null): boolean {
  if (p.kind === "pronounce") return !!a && a.score >= 60;
  return selected === p.answer;
}
