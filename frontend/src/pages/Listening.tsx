import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { speak } from "../api/audio";
import type { PhraseCollection } from "../types";
import { Loading, SpeakButton } from "../components/common";
import PhraseTopicList from "../components/PhraseTopicList";

interface Pill {
  id: number;
  word: string;
}

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
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [collection, setCollection] = useState<PhraseCollection | null>(null);
  const [idx, setIdx] = useState(0);
  const [pills, setPills] = useState<Pill[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!collectionId) {
      setCollection(null);
      return;
    }
    setIdx(0);
    setFinished(false);
    api.phrases(collectionId).then(setCollection).catch(() => setCollection(null));
  }, [collectionId]);

  const phrase = collection?.phrases[idx];
  const target = useMemo(() => (phrase ? tokenize(phrase.pt) : []), [phrase]);

  // Word bank = target words + distractors drawn from the collection's other phrases.
  useEffect(() => {
    if (!collection || !phrase) return;
    const bankWords = new Map<string, string>();
    for (const p of collection.phrases)
      for (const w of tokenize(p.pt)) {
        const k = w.toLowerCase();
        if (!bankWords.has(k)) bankWords.set(k, w);
      }
    const targetLower = new Set(target.map((w) => w.toLowerCase()));
    const distractors = shuffle(
      [...bankWords.values()].filter((w) => !targetLower.has(w.toLowerCase())),
    ).slice(0, clamp(Math.round(target.length * 0.7), 2, 6));
    const built: Pill[] = shuffle([
      ...target.map((w, k) => ({ id: k, word: w })),
      ...distractors.map((w, k) => ({ id: 1000 + k, word: w })),
    ]);
    setPills(built);
    setSelected([]);
    setChecked(false);
    // Auto-play the phrase when it appears.
    speak(phrase.pt);
  }, [collection, phrase, target]);

  if (!collectionId) {
    return (
      <div>
        <div className="page-head">
          <div>
            <h1>🎧 Listening Practice</h1>
            <p className="muted">
              Pick a topic and work through real Brazilian phrases: hear each one and
              rebuild it by tapping the words (some are extras, to test your ear).
            </p>
          </div>
        </div>
        <PhraseTopicList onOpen={setCollectionId} actionLabel="Listen & build" />
      </div>
    );
  }

  if (!collection || !phrase) return <Loading what="phrases" />;

  const pillById = (id: number) => pills.find((p) => p.id === id);
  const selectedWords = selected.map((id) => pillById(id)?.word ?? "");
  const available = pills.filter((p) => !selected.includes(p.id));
  const posOk = (k: number) =>
    !!target[k] && selectedWords[k]?.toLowerCase() === target[k].toLowerCase();
  const correctCount = target.reduce((a, _w, k) => a + (posOk(k) ? 1 : 0), 0);
  const exact = checked && selectedWords.length === target.length && correctCount === target.length;

  const next = () => {
    if (idx + 1 < collection.phrases.length) {
      setIdx(idx + 1);
    } else {
      api.markPhrases(collection.id).catch(() => {});
      setFinished(true);
    }
  };

  if (finished) {
    return (
      <div>
        <button className="btn ghost" onClick={() => setCollectionId(null)}>← All topics</button>
        <div className="card center mt-lg">
          <h1>✓ {collection.title}</h1>
          <p className="muted">You worked through all {collection.phrases.length} phrases.</p>
          <div className="row center mt">
            <button className="btn green" onClick={() => { setIdx(0); setFinished(false); }}>
              Practice again
            </button>
            <a className="btn" href={`/knowledge/phrases/${collection.id}`}>Knowledge test →</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button className="btn ghost" onClick={() => setCollectionId(null)}>← All topics</button>
      <div className="page-head mt">
        <div>
          <span className="badge blue">{collection.level}</span>
          <h1 style={{ marginTop: 8 }}>🎧 {collection.title}</h1>
        </div>
        <span className="muted">Phrase {idx + 1} / {collection.phrases.length}</span>
      </div>
      <div className="progress" style={{ marginBottom: 14 }}>
        <span style={{ width: `${((idx + 1) / collection.phrases.length) * 100}%` }} />
      </div>

      <div className="card">
        <div className="center row" style={{ justifyContent: "center" }}>
          <button className="btn big" onClick={() => speak(phrase.pt)}>🔊 Play</button>
          <button className="btn ghost" onClick={() => speak(phrase.pt, 0.7)}>🐢 Slow</button>
        </div>

        <div className="answer-box mt">
          {selected.length === 0 ? (
            <span className="muted">Tap the words in the order you hear them…</span>
          ) : (
            selected.map((id, k) => {
              let cls = "answer-pill";
              if (checked) cls += posOk(k) ? " ok" : " bad";
              return (
                <button
                  key={id}
                  className={cls}
                  onClick={() => !checked && setSelected(selected.filter((_, i) => i !== k))}
                >
                  {pillById(id)?.word}
                </button>
              );
            })
          )}
        </div>

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
              <strong>✅ Perfeito!</strong>
            ) : (
              <>
                <div>You matched <strong>{correctCount}</strong> / {target.length} words.</div>
                <div className="pt mt" style={{ fontSize: "1.1rem" }}>
                  {phrase.pt} <SpeakButton text={phrase.pt} />
                </div>
              </>
            )}
            <div className="en mt">{phrase.en}</div>
            {phrase.note && <div className="small muted mt">💡 {phrase.note}</div>}
          </div>
        )}

        <div className="row mt">
          {!checked ? (
            <>
              <button className="btn green" onClick={() => setChecked(true)} disabled={selected.length === 0}>
                Check
              </button>
              <button className="btn ghost" onClick={() => setSelected([])} disabled={selected.length === 0}>
                Clear
              </button>
            </>
          ) : (
            <button className="btn" onClick={next}>
              {idx + 1 < collection.phrases.length ? "Next phrase →" : "Finish"}
            </button>
          )}
          <button className="btn ghost" onClick={next}>Skip</button>
        </div>
      </div>
    </div>
  );
}
