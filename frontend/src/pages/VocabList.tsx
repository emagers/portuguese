import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { ContentSummary } from "../types";
import { LevelBadge, LevelFilter, Loading } from "../components/common";

export default function VocabList() {
  const [params, setParams] = useSearchParams();
  const level = params.get("level");
  const [items, setItems] = useState<ContentSummary[] | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});

  useEffect(() => {
    setItems(null);
    api.vocabList(level || undefined).then(setItems).catch(() => setItems([]));
  }, [level]);

  useEffect(() => {
    api.progressSummary().then((p) => setDone(p.decks || {})).catch(() => {});
  }, []);

  const setLevel = (v: string | null) => (v ? setParams({ level: v }) : setParams({}));

  const completedCount = items ? items.filter((it) => done[it.id] === "completed").length : 0;

  return (
    <div>
      <div className="page-head">
        <h1>🗂️ Vocabulary</h1>
        <LevelFilter value={level} onChange={setLevel} />
      </div>
      {!items ? (
        <Loading what="decks" />
      ) : items.length === 0 ? (
        <div className="empty">No decks for this level yet.</div>
      ) : (
        <>
          <p className="muted small">
            {completedCount} / {items.length} completed
          </p>
          <div className="grid">
            {items.map((it) => (
              <Link key={it.id} className="card link" to={`/vocab/${it.id}`}>
                <div className="row spread">
                  <LevelBadge level={it.level} />
                  {done[it.id] === "completed" ? (
                    <span className="badge done">✓ Done</span>
                  ) : (
                    <span className="muted small">{it.count} cards</span>
                  )}
                </div>
                <h3 className="mt">{it.title}</h3>
                <p className="sub">{it.subtitle}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
