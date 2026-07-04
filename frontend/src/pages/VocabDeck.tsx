import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { speak } from "../api/audio";
import type { VocabDeck } from "../types";
import { LevelBadge, Loading, SpeakButton } from "../components/common";

const GRADES = [
  { label: "Again", grade: 1, cls: "again" },
  { label: "Hard", grade: 3, cls: "hard" },
  { label: "Good", grade: 4, cls: "good" },
  { label: "Easy", grade: 5, cls: "easy" },
];

export default function VocabDeckPage() {
  const { id } = useParams();
  const [deck, setDeck] = useState<VocabDeck | null>(null);
  const [mode, setMode] = useState<"study" | "browse">("study");
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.vocab(id).then(setDeck).catch(() => setDeck(null));
    api
      .progressSummary()
      .then((p) => setCompleted((p.decks || {})[id] === "completed"))
      .catch(() => {});
  }, [id]);

  const card = useMemo(() => deck?.cards[idx], [deck, idx]);

  if (!deck) return <Loading what="deck" />;

  const markComplete = () => {
    setCompleted(true);
    api.markDeck(deck.id).catch(() => {});
  };

  const grade = (g: number) => {
    if (!card) return;
    api.reviewCard(card.id, deck.id, g).catch(() => {});
    const nextReviewed = reviewed + 1;
    setReviewed(nextReviewed);
    // Auto-complete once the learner has graded every card at least once.
    if (nextReviewed >= deck.cards.length && !completed) markComplete();
    setFlipped(false);
    setIdx((i) => (i + 1 < deck.cards.length ? i + 1 : 0));
  };

  const flip = () => {
    if (!flipped && card) speak(card.pt);
    setFlipped((f) => !f);
  };

  return (
    <div>
      <Link to="/vocab" className="small">← All decks</Link>
      <div className="page-head mt">
        <div>
          <LevelBadge level={deck.level} />{" "}
          {completed && <span className="badge done">✓ Completed</span>}
          <h1 style={{ marginTop: 8 }}>{deck.title}</h1>
          <p className="muted">{deck.description}</p>
        </div>
        <div className="row">
          <button
            className={`level-pill ${mode === "study" ? "active" : ""}`}
            onClick={() => setMode("study")}
          >
            Study
          </button>
          <button
            className={`level-pill ${mode === "browse" ? "active" : ""}`}
            onClick={() => setMode("browse")}
          >
            Browse
          </button>
          <button className="btn green" onClick={markComplete} disabled={completed}>
            {completed ? "✓ Completed" : "Mark complete"}
          </button>
          <Link className="btn" to={`/knowledge/vocab/${deck.id}`}>
            ✅ Knowledge test
          </Link>
        </div>
      </div>

      {mode === "study" && card && (
        <div>
          <div className="row spread small muted">
            <span>
              Card {idx + 1} / {deck.cards.length}
            </span>
            <span>{reviewed} reviewed this session</span>
          </div>
          <div className="progress mt">
            <span style={{ width: `${((idx + 1) / deck.cards.length) * 100}%` }} />
          </div>

          <div className="card flashcard mt" onClick={flip}>
            {!flipped ? (
              <>
                <div className="pt" style={{ fontSize: "2rem" }}>
                  {card.pt} <SpeakButton text={card.pt} />
                </div>
                {card.ipa && <div className="ipa">[{card.ipa}]</div>}
                <div className="muted small">tap to reveal</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: "1.6rem" }}>{card.en}</div>
                {card.pos && (
                  <div className="muted small">
                    {card.pos}
                    {card.gender ? ` · ${card.gender}` : ""}
                  </div>
                )}
                {card.example && (
                  <div className="example" style={{ fontSize: "1rem", textAlign: "left" }}>
                    <div className="pt">
                      {card.example.pt} <SpeakButton text={card.example.pt} />
                    </div>
                    <div className="en">{card.example.en}</div>
                  </div>
                )}
              </>
            )}
          </div>

          {flipped ? (
            <div className="grade-row mt">
              {GRADES.map((g) => (
                <button key={g.grade} className={`grade ${g.cls}`} onClick={() => grade(g.grade)}>
                  {g.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="center mt">
              <button className="btn" onClick={flip}>
                Show answer
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "browse" && (
        <table>
          <thead>
            <tr>
              <th>Portuguese</th>
              <th>English</th>
              <th>IPA</th>
              <th>Example</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {deck.cards.map((c) => (
              <tr key={c.id}>
                <td className="pt">{c.pt}</td>
                <td>{c.en}</td>
                <td className="muted small">{c.ipa ? `[${c.ipa}]` : ""}</td>
                <td className="small">{c.example?.pt}</td>
                <td>
                  <SpeakButton text={c.pt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
