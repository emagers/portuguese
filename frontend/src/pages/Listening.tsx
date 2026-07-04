import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { speak } from "../api/audio";
import { LevelFilter, Loading } from "../components/common";

interface Item {
  pt: string;
  en: string;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x && !y) return 1;
  const m = x.length;
  const n = y.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        x[i - 1] === y[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  const dist = dp[m][n];
  return Math.max(0, 1 - dist / Math.max(m, n, 1));
}

export default function Listening() {
  const [level, setLevel] = useState<string | null>(null);
  const [pool, setPool] = useState<Item[] | null>(null);
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setPool(null);
    setI(0);
    setText("");
    setRevealed(false);
    (async () => {
      const summaries = await api.storyList(level || undefined).catch(() => []);
      const chosen = summaries.slice(0, 8);
      const stories = await Promise.all(chosen.map((s) => api.story(s.id).catch(() => null)));
      const items: Item[] = [];
      for (const st of stories) {
        if (!st) continue;
        if (st.type === "conversation")
          st.lines.forEach((l) => items.push({ pt: l.pt, en: l.en }));
        else st.paragraphs.forEach((p) => items.push({ pt: p.pt, en: p.en }));
      }
      // shuffle
      for (let k = items.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [items[k], items[j]] = [items[j], items[k]];
      }
      setPool(items.slice(0, 40));
    })();
  }, [level]);

  const item = useMemo(() => pool?.[i], [pool, i]);
  const score = item && text ? Math.round(similarity(text, item.pt) * 100) : 0;

  const next = () => {
    setText("");
    setRevealed(false);
    setI((n) => (pool && n + 1 < pool.length ? n + 1 : 0));
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🎧 Listening Practice</h1>
          <p className="muted">
            Dictation drill: play a sentence, type what you hear, then check how
            close you were.
          </p>
        </div>
        <LevelFilter value={level} onChange={setLevel} />
      </div>

      {!pool ? (
        <Loading what="audio clips" />
      ) : !item ? (
        <div className="empty">No listening material for this level yet.</div>
      ) : (
        <div className="card">
          <div className="row spread small muted">
            <span>Clip {i + 1} / {pool.length}</span>
          </div>
          <div className="center stack mt">
            <div className="row center">
              <button className="btn big" onClick={() => speak(item.pt)}>🔊 Play</button>
              <button className="btn ghost" onClick={() => speak(item.pt, 0.7)}>🐢 Slow</button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type what you hear…"
              rows={2}
              style={{ width: "100%", fontSize: "1.1rem", padding: 10, borderRadius: 8, border: "1px solid var(--border)" }}
            />
          </div>

          {revealed && (
            <div className="banner mt">
              <div className="pt" style={{ fontSize: "1.15rem" }}>{item.pt}</div>
              <div className="en">{item.en}</div>
              <div className="mt">
                Accuracy:{" "}
                <strong style={{ color: score >= 75 ? "var(--ok)" : score >= 50 ? "var(--warn)" : "var(--err)" }}>
                  {score}%
                </strong>
              </div>
            </div>
          )}

          <div className="row mt">
            {!revealed ? (
              <button className="btn green" onClick={() => setRevealed(true)} disabled={!text.trim()}>
                Check
              </button>
            ) : (
              <button className="btn" onClick={next}>Next clip →</button>
            )}
            <button className="btn ghost" onClick={next}>Skip</button>
          </div>
        </div>
      )}
    </div>
  );
}
