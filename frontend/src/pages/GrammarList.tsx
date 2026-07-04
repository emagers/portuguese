import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { ContentSummary } from "../types";
import { LevelBadge, LevelFilter, Loading } from "../components/common";

export default function GrammarList() {
  const [params, setParams] = useSearchParams();
  const level = params.get("level");
  const [items, setItems] = useState<ContentSummary[] | null>(null);

  useEffect(() => {
    setItems(null);
    api.grammarList(level || undefined).then(setItems).catch(() => setItems([]));
  }, [level]);

  const setLevel = (v: string | null) => {
    if (v) setParams({ level: v });
    else setParams({});
  };

  return (
    <div>
      <div className="page-head">
        <h1>📖 Grammar Lessons</h1>
        <LevelFilter value={level} onChange={setLevel} />
      </div>
      {!items ? (
        <Loading what="lessons" />
      ) : items.length === 0 ? (
        <div className="empty">No lessons for this level yet.</div>
      ) : (
        <div className="grid">
          {items.map((it) => (
            <Link key={it.id} className="card link" to={`/grammar/${it.id}`}>
              <div className="row spread">
                <LevelBadge level={it.level} />
                <span className="muted small">{it.count} sections</span>
              </div>
              <h3 className="mt">{it.title}</h3>
              <p className="sub">{it.subtitle}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
