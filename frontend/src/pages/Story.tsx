import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { speak, stopSpeaking } from "../api/audio";
import type { Story } from "../types";
import { LevelBadge, Loading, SpeakButton } from "../components/common";

export default function StoryPage() {
  const { id } = useParams();
  const [story, setStory] = useState<Story | null>(null);
  const [showEn, setShowEn] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.story(id).then(setStory).catch(() => setStory(null));
    return () => stopSpeaking();
  }, [id]);

  if (!story) return <Loading what="story" />;

  const playAll = async () => {
    const texts =
      story.type === "conversation"
        ? story.lines.map((l) => l.pt)
        : story.paragraphs.map((p) => p.pt);
    for (const t of texts) {
      // eslint-disable-next-line no-await-in-loop
      await speak(t);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 350));
    }
  };

  const score = story.comprehension.filter((q) => answers[q.id] === q.answer).length;

  return (
    <article>
      <Link to="/stories" className="small">← All stories</Link>
      <div className="page-head mt">
        <div>
          <LevelBadge level={story.level} />
          <h1 style={{ marginTop: 8 }}>{story.title}</h1>
          {story.titlePt && <p className="muted" style={{ marginTop: -6 }}>{story.titlePt}</p>}
          <p>{story.summary}</p>
        </div>
        <div className="row">
          <button className="btn" onClick={playAll}>▶️ Play all</button>
          <button className="btn ghost" onClick={() => setShowEn((s) => !s)}>
            {showEn ? "Hide" : "Show"} English
          </button>
        </div>
      </div>

      {story.type === "conversation" ? (
        <div className="card">
          {story.lines.map((l, i) => (
            <div key={i} className="line">
              <div className="speaker">{l.speaker}</div>
              <div style={{ flex: 1 }}>
                <div className="pt">
                  {l.pt} <SpeakButton text={l.pt} />
                </div>
                {showEn && <div className="en">{l.en}</div>}
                {l.note && <div className="small muted">💡 {l.note}</div>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card stack">
          {story.paragraphs.map((p, i) => (
            <div key={i}>
              <div className="pt">
                {p.pt} <SpeakButton text={p.pt} />
              </div>
              {showEn && <div className="en">{p.en}</div>}
            </div>
          ))}
        </div>
      )}

      {story.glossary.length > 0 && (
        <section className="mt-lg">
          <h2>Glossary</h2>
          <table>
            <tbody>
              {story.glossary.map((g, i) => (
                <tr key={i}>
                  <td className="pt">
                    {g.pt} <SpeakButton text={g.pt} />
                  </td>
                  <td>{g.en}</td>
                  <td className="small muted">{g.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {story.comprehension.length > 0 && (
        <section className="mt-lg">
          <h2>Comprehension check</h2>
          {story.comprehension.map((q) => (
            <div key={q.id} className="card mt">
              <div className="pt">{q.question}</div>
              {q.options.map((opt) => {
                const sel = answers[q.id] === opt;
                let cls = "option";
                if (sel) cls += " selected";
                if (checked) {
                  if (opt === q.answer) cls += " correct";
                  else if (sel) cls += " wrong";
                }
                return (
                  <button
                    key={opt}
                    className={cls}
                    onClick={() => !checked && setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  >
                    {opt}
                  </button>
                );
              })}
              {checked && q.explanation && (
                <div className="small muted mt">💡 {q.explanation}</div>
              )}
            </div>
          ))}
          {!checked ? (
            <button
              className="btn green mt"
              disabled={Object.keys(answers).length < story.comprehension.length}
              onClick={() => setChecked(true)}
            >
              Check answers
            </button>
          ) : (
            <div className="banner mt">
              You got <strong>{score}</strong> / {story.comprehension.length} correct.
            </div>
          )}
        </section>
      )}
    </article>
  );
}
