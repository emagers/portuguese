import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { ContentSummary } from "../types";
import { LevelBadge, Loading } from "./common";

const TOPIC_LABELS: Record<string, string> = {
  social: "👋 Social",
  socializing: "🥳 Socializing",
  food: "🍽️ Food & Dining",
  travel: "✈️ Travel",
  accommodation: "🏨 Accommodation",
  shopping: "🛍️ Shopping",
  health: "🩺 Health",
  money: "💰 Money",
  work: "💼 Work",
  directions: "🧭 Directions",
  emergencies: "🚨 Emergencies",
  daily: "🏠 Daily life",
  weather: "🌤️ Weather",
  transport: "🚗 Transport",
  communication: "📞 Communication",
  feelings: "😊 Feelings",
  "numbers-time": "🕐 Numbers & Time",
  tourism: "📸 Tourism",
};

const label = (t: string) => TOPIC_LABELS[t] || t;

// Topic-grouped browser of phrase collections. Used by Listening and
// Pronunciation so the learner can work through them like grammar sections.
export default function PhraseTopicList({
  onOpen,
  actionLabel,
}: {
  onOpen: (id: string) => void;
  actionLabel: string;
}) {
  const [items, setItems] = useState<ContentSummary[] | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});

  useEffect(() => {
    api.phraseList().then(setItems).catch(() => setItems([]));
    api.progressSummary().then((p) => setDone(p.phrases || {})).catch(() => {});
  }, []);

  if (!items) return <Loading what="phrase collections" />;
  if (items.length === 0) return <div className="empty">No phrase collections yet.</div>;

  const byTopic: Record<string, ContentSummary[]> = {};
  for (const it of items) {
    const t = it.tags[0] || "general";
    (byTopic[t] ||= []).push(it);
  }
  const topics = Object.keys(byTopic).sort();
  const completedCount = items.filter((it) => done[it.id] === "completed").length;

  return (
    <div>
      <p className="muted small">{completedCount} / {items.length} collections completed</p>
      {topics.map((topic) => (
        <section key={topic} className="mt">
          <h2>{label(topic)}</h2>
          <div className="grid">
            {byTopic[topic].map((it) => (
              <button
                key={it.id}
                className="card link"
                style={{ textAlign: "left", cursor: "pointer" }}
                onClick={() => onOpen(it.id)}
              >
                <div className="row spread">
                  <LevelBadge level={it.level} />
                  {done[it.id] === "completed" ? (
                    <span className="badge done">✓ Done</span>
                  ) : (
                    <span className="muted small">{it.count} phrases</span>
                  )}
                </div>
                <h3 className="mt">{it.title}</h3>
                <p className="sub">{it.subtitle}</p>
                <span className="btn ghost mt" style={{ pointerEvents: "none" }}>{actionLabel} →</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
