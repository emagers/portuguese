import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { speak } from "../api/audio";
import { LevelFilter, Loading } from "../components/common";

interface Item {
  pt: string;
  en: string;
}
interface Pill {
  id: number;
  word: string;
  target: boolean;
}

// Split a sentence into words, stripping surrounding punctuation but keeping
// internal hyphens/apostrophes (e.g. "segunda-feira").
function tokenize(sentence: string): string[] {
  return sentence
    .replace(/[“”"'’‘]/g, "")
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}-]+|[^\p{L}\p{N}-]+$/gu, ""))
    .filter(Boolean);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let k = a.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [a[k], a[j]] = [a[j], a[k]];
  }
  return a;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export default function Listening() {
  const [level, setLevel] = useState<string | null>(null);
  const [pool, setPool] = useState<Item[] | null>(null);
  const [bank, setBank] = useState<string[]>([]);
  const [i, setI] = useState(0);
  const [pills, setPills] = useState<Pill[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setPool(null);
    setI(0);
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
      // Keep sentences that make a manageable word-bank exercise.
      const playable = items.filter((it) => {
        const n = tokenize(it.pt).length;
        return n >= 3 && n <= 12;
      });
      // Distractor bank: every unique word across the playable set.
      const seen = new Map<string, string>();
      for (const it of playable)
        for (const w of tokenize(it.pt)) {
          const key = w.toLowerCase();
          if (!seen.has(key)) seen.set(key, w);
        }
      setBank([...seen.values()]);
      setPool(shuffle(playable).slice(0, 40));
    })();
  }, [level]);

  const item = useMemo(() => pool?.[i], [pool, i]);
  const target = useMemo(() => (item ? tokenize(item.pt) : []), [item]);

  // Build the word bank (target words + distractors) whenever the clip changes.
  useEffect(() => {
    if (!item) return;
    const targetLower = new Set(target.map((w) => w.toLowerCase()));
    const distractors = shuffle(bank.filter((w) => !targetLower.has(w.toLowerCase()))).slice(
      0,
      clamp(Math.round(target.length * 0.8), 3, 8),
    );
    const built: Pill[] = [
      ...target.map((w, k) => ({ id: k, word: w, target: true })),
      ...distractors.map((w, k) => ({ id: 1000 + k, word: w, target: false })),
    ];
    setPills(shuffle(built));
    setSelected([]);
    setChecked(false);
  }, [item, target, bank]);

  if (!pool) return <Loading what="audio clips" />;
  if (!item)
    return (
      <div>
        <div className="page-head">
          <h1>🎧 Listening Practice</h1>
          <LevelFilter value={level} onChange={setLevel} />
        </div>
        <div className="empty">No listening material for this level yet.</div>
      </div>
    );

  const pillById = (id: number) => pills.find((p) => p.id === id);
  const selectedWords = selected.map((id) => pillById(id)?.word ?? "");
  const available = pills.filter((p) => !selected.includes(p.id));

  const posOk = (k: number) =>
    !!target[k] && selectedWords[k]?.toLowerCase() === target[k].toLowerCase();
  const correctCount = target.reduce((acc, _w, k) => acc + (posOk(k) ? 1 : 0), 0);
  const exact =
    checked && selectedWords.length === target.length && correctCount === target.length;

  const next = () => setI((n) => (n + 1 < pool.length ? n + 1 : 0));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>🎧 Listening Practice</h1>
          <p className="muted">
            Play the sentence, then tap the words in the order you hear them. Some
            words are extras that were not said — choose carefully!
          </p>
        </div>
        <LevelFilter value={level} onChange={setLevel} />
      </div>

      <div className="card">
        <div className="row spread small muted">
          <span>Clip {i + 1} / {pool.length}</span>
          <span>{target.length} words to find</span>
        </div>

        <div className="center row" style={{ justifyContent: "center", marginTop: 8 }}>
          <button className="btn big" onClick={() => speak(item.pt)}>🔊 Play</button>
          <button className="btn ghost" onClick={() => speak(item.pt, 0.7)}>🐢 Slow</button>
        </div>

        {/* Your answer */}
        <div className="answer-box mt">
          {selected.length === 0 ? (
            <span className="muted">Tap words below to build the sentence…</span>
          ) : (
            selected.map((id, k) => {
              let cls = "answer-pill";
              if (checked) cls += posOk(k) ? " ok" : " bad";
              return (
                <button
                  key={id}
                  className={cls}
                  onClick={() => !checked && setSelected(selected.filter((_, idx) => idx !== k))}
                  title={checked ? undefined : "Tap to remove"}
                >
                  {pillById(id)?.word}
                </button>
              );
            })
          )}
        </div>

        {/* Word bank */}
        {!checked && (
          <div className="pill-tray mt">
            {available.map((p) => (
              <button key={p.id} className="pill" onClick={() => setSelected([...selected, p.id])}>
                {p.word}
              </button>
            ))}
          </div>
        )}

        {checked && (
          <div className={`banner ${exact ? "" : "err"} mt`}>
            {exact ? (
              <strong>✅ Perfeito! You got every word.</strong>
            ) : (
              <>
                <div>
                  You matched <strong>{correctCount}</strong> / {target.length} words.
                </div>
                <div className="pt mt" style={{ fontSize: "1.1rem" }}>
                  Correct answer: {item.pt}
                </div>
              </>
            )}
            <div className="en mt">{item.en}</div>
          </div>
        )}

        <div className="row mt">
          {!checked ? (
            <>
              <button
                className="btn green"
                onClick={() => setChecked(true)}
                disabled={selected.length === 0}
              >
                Check
              </button>
              <button
                className="btn ghost"
                onClick={() => setSelected([])}
                disabled={selected.length === 0}
              >
                Clear
              </button>
            </>
          ) : (
            <>
              {!exact && (
                <button className="btn ghost" onClick={() => { setSelected([]); setChecked(false); }}>
                  Try again
                </button>
              )}
              <button className="btn" onClick={next}>Next clip →</button>
            </>
          )}
          <button className="btn ghost" onClick={next}>Skip</button>
        </div>
      </div>
    </div>
  );
}
