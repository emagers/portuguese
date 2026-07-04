import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import type { ContentSummary } from "../types";
import { LevelBadge, LevelFilter, Loading } from "../components/common";

export default function StoriesList() {
  const [params, setParams] = useSearchParams();
  const level = params.get("level");
  const [items, setItems] = useState<ContentSummary[] | null>(null);

  useEffect(() => {
    setItems(null);
    api.storyList(level || undefined).then(setItems).catch(() => setItems([]));
  }, [level]);

  const setLevel = (v: string | null) => (v ? setParams({ level: v }) : setParams({}));

  return (
    <div>
      <div className="page-head">
        <h1>💬 Stories & Conversations</h1>
        <LevelFilter value={level} onChange={setLevel} />
      </div>
      {!items ? (
        <Loading what="stories" />
      ) : items.length === 0 ? (
        <div className="empty">No stories for this level yet.</div>
      ) : (
        <div className="grid">
          {items.map((it) => (
            <Link key={it.id} className="card link" to={`/stories/${it.id}`}>
              <div className="row spread">
                <LevelBadge level={it.level} />
                <span className={`badge ${it.kind === "conversation" ? "green" : "gray"}`}>
                  {it.kind === "conversation" ? "💬 dialogue" : "📄 story"}
                </span>
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
