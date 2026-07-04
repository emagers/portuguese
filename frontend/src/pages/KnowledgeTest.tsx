import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { KnowledgeTest } from "../types";
import { Loading } from "../components/common";
import ProblemSession from "../components/ProblemSession";

const backFor = (type?: string, id?: string) => {
  if (type === "grammar") return `/grammar/${id}`;
  if (type === "vocab") return `/vocab/${id}`;
  if (type === "phrases") return "/pronunciation";
  return "/";
};

export default function KnowledgeTestPage() {
  const { type, id } = useParams();
  const [test, setTest] = useState<KnowledgeTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!type || !id) return;
    setTest(null);
    const fetcher =
      type === "grammar"
        ? api.knowledgeGrammar
        : type === "vocab"
          ? api.knowledgeVocab
          : api.knowledgePhrases;
    fetcher(id)
      .then(setTest)
      .catch((e) => setError(String(e.message || e)));
  }, [type, id, nonce]);

  if (error) return <div className="banner err">⚠️ {error}</div>;
  if (!test) return <Loading what="knowledge test" />;

  return (
    <div>
      <Link to={backFor(type, id)} className="small">← Back to section</Link>
      <div className="page-head mt">
        <div>
          <span className="badge blue">{test.section.level}</span>
          <h1 style={{ marginTop: 8 }}>{test.title}</h1>
          <p className="muted">Test your knowledge of this section.</p>
        </div>
      </div>
      <ProblemSession
        problems={test.problems}
        restartLabel="Retake (new questions)"
        onRestart={() => setNonce((n) => n + 1)}
      />
    </div>
  );
}
