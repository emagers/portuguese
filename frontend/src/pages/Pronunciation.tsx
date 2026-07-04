import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { Recorder, speak } from "../api/audio";
import type { Assessment } from "../types";
import { SpeakButton } from "../components/common";

const SUGGESTIONS = [
  "Bom dia! Tudo bem?",
  "Eu quero um café com leite, por favor.",
  "Onde fica a estação de trem?",
  "Muito prazer em conhecer você.",
  "O Rio de Janeiro é uma cidade maravilhosa.",
  "Você pode falar mais devagar, por favor?",
  "Eu estou aprendendo português brasileiro.",
  "Quanto custa esse pãozinho?",
  "A gente vai à praia no fim de semana.",
  "Obrigado pela sua ajuda!",
];

function scoreColor(s: number) {
  if (s >= 75) return "var(--ok)";
  if (s >= 50) return "var(--warn)";
  return "var(--err)";
}

export default function Pronunciation() {
  const [target, setTarget] = useState(SUGGESTIONS[0]);
  const [status, setStatus] = useState<any>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Assessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refIpa, setRefIpa] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const recorderRef = useRef<Recorder | null>(null);

  useEffect(() => {
    api.pronunciationStatus().then(setStatus).catch(() => {});
    api.pronunciationHistory().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    setRefIpa(null);
    const t = setTimeout(() => {
      if (target.trim())
        fetch(`/api/pronunciation/phonemes?text=${encodeURIComponent(target)}`)
          .then((r) => r.json())
          .then((j) => setRefIpa(j.ipa))
          .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [target]);

  const start = async () => {
    setError(null);
    setResult(null);
    try {
      recorderRef.current = new Recorder();
      await recorderRef.current.start();
      setRecording(true);
    } catch (e) {
      setError("Microphone access denied or unavailable.");
    }
  };

  const stop = async () => {
    if (!recorderRef.current) return;
    setRecording(false);
    setBusy(true);
    try {
      const blob = await recorderRef.current.stop();
      const res = await api.assess(target, blob);
      setResult(res);
      api.pronunciationHistory().then(setHistory).catch(() => {});
    } catch (e: any) {
      setError(e.message || "Assessment failed.");
    } finally {
      setBusy(false);
    }
  };

  const asrReady = status?.ready ?? false;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🎙️ Pronunciation Coach</h1>
          <p className="muted">
            Listen to the phrase, record yourself, and get a score with
            sound-by-sound feedback — all processed locally.
          </p>
        </div>
      </div>

      {!asrReady && (
        <div className="banner">
          <strong>Speech recognition isn't set up yet.</strong> Run{" "}
          <code>scripts/setup.ps1</code> to enable pronunciation scoring. You can
          still listen to target phrases below.
          {status?.asr?.reason && <div className="small muted mt">{status.asr.reason}</div>}
        </div>
      )}

      <div className="card">
        <label className="small muted">Phrase to practise</label>
        <textarea
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          rows={2}
          style={{ width: "100%", fontSize: "1.1rem", padding: 10, borderRadius: 8, border: "1px solid var(--border)", marginTop: 6 }}
        />
        <div className="row mt">
          <button className="btn" onClick={() => speak(target)}>🔊 Listen</button>
          <button className="btn ghost" onClick={() => speak(target, 0.7)}>🐢 Slow</button>
          {refIpa && <span className="muted">Target: <code>/{refIpa}/</code></span>}
        </div>
        <div className="row mt">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="tag"
              style={{ cursor: "pointer", border: "none" }}
              onClick={() => setTarget(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card center mt">
        {!recording ? (
          <button className="btn big green" onClick={start} disabled={busy || !asrReady}>
            {busy ? "Analysing…" : "● Start recording"}
          </button>
        ) : (
          <button className="btn big rec" onClick={stop}>
            ■ Stop & analyse
          </button>
        )}
        {recording && <p className="muted mt">Recording… speak the phrase, then press stop.</p>}
        {error && <div className="banner err mt">⚠️ {error}</div>}
      </div>

      {result && <Result r={result} />}

      {history.length > 0 && (
        <section className="mt-lg">
          <h2>Recent attempts</h2>
          <table>
            <thead>
              <tr><th>Phrase</th><th>Score</th><th>When</th></tr>
            </thead>
            <tbody>
              {history.slice(0, 8).map((h, i) => (
                <tr key={i}>
                  <td>{h.phrase} <SpeakButton text={h.phrase} /></td>
                  <td style={{ color: scoreColor(h.score), fontWeight: 700 }}>{Math.round(h.score)}</td>
                  <td className="small muted">{new Date(h.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Result({ r }: { r: Assessment }) {
  return (
    <div className="card mt">
      <div className="row spread">
        <div>
          <div className="score-big" style={{ color: scoreColor(r.score) }}>{r.score}</div>
          <div className="muted">/ 100</div>
        </div>
        <div style={{ flex: 1, marginLeft: 24 }}>
          <h3>{r.verdict}</h3>
          <p className="small muted">
            We heard: <strong>“{r.transcript || "—"}”</strong>
          </p>
        </div>
      </div>

      <h4 className="mt">Word by word</h4>
      <div style={{ fontSize: "1.15rem", lineHeight: 2 }}>
        {r.words.tokens.map((t, i) => (
          <span key={i} className={`token ${t.status}`} title={t.status}>
            {t.expected ?? t.heard}
          </span>
        ))}
      </div>
      <div className="small muted mt">
        {r.words.correct} correct · {r.words.substituted} off · {r.words.missing} missing
        {r.words.extra ? ` · ${r.words.extra} extra` : ""}
      </div>

      {r.phonemes && (
        <div className="mt">
          <h4>Sounds (target vs. what was understood)</h4>
          <div className="small">
            <div>Target: <code>{r.phonemes.reference.join(" ")}</code></div>
            <div>Heard: <code>{r.phonemes.hypothesis.join(" ")}</code></div>
          </div>
          <div className="progress mt" style={{ maxWidth: 320 }}>
            <span style={{ width: `${Math.round(r.phonemes.phoneme_accuracy * 100)}%` }} />
          </div>
          <div className="small muted">
            {Math.round(r.phonemes.phoneme_accuracy * 100)}% of sounds matched
          </div>
        </div>
      )}

      {r.acoustic_phonemes && (
        <div className="mt">
          <h4>What your voice actually sounded like 🎤</h4>
          <div className="small">
            <code>{r.acoustic_phonemes}</code>
          </div>
          <div className="small muted">
            Detected directly from your recording (independent of the transcript).
          </div>
        </div>
      )}

      {r.tips.length > 0 && (
        <div className="mt">
          <h4>Tips to improve</h4>
          <div className="stack">
            {r.tips.map((t, i) => (
              <div key={i} className="keypoint">💡 {t}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
