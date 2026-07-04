import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { ContentSummary } from "../types";
import { LevelBadge, LevelFilter, Loading } from "../components/common";

const TOPIC_ICON: Record<string, string> = {
  grammar: "📐",
  vocab: "🗂️",
  listening: "🎧",
  mixed: "🎲",
};

export default function QuizList() {
  const [params, setParams] = useSearchParams();
  const level = params.get("level");
  const [items, setItems] = useState<ContentSummary[] | null>(null);

  useEffect(() => {
    setItems(null);
    api.quizList(level || undefined).then(setItems).catch(() => setItems([]));
  }, [level]);

  const setLevel = (v: string | null) => (v ? setParams({ level: v }) : setParams({}));

  return (
    <div>
      <div className="page-head">
        <h1>✅ Knowledge Tests</h1>
        <LevelFilter value={level} onChange={setLevel} />
      </div>
      {!items ? (
        <Loading what="quizzes" />
      ) : items.length === 0 ? (
        <div className="empty">No tests for this level yet.</div>
      ) : (
        <div className="grid">
          {items.map((it) => (
            <Link key={it.id} className="card link" to={`/quizzes/${it.id}`}>
              <div className="row spread">
                <LevelBadge level={it.level} />
                <span className="tag">
                  {TOPIC_ICON[it.tags[0]] || "🎲"} {it.tags[0]}
                </span>
              </div>
              <h3 className="mt">{it.title}</h3>
              <p className="sub">{it.count} questions</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
