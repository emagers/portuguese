import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { getVoices, speak, stopSpeaking } from "../api/audio";
import type { Story } from "../types";
import { LevelBadge, Loading, SpeakButton } from "../components/common";

const SPEAKER_COLORS = ["#002776", "#067a30", "#9a3412", "#6b21a8", "#0e7490", "#a16207"];

export default function StoryPage() {
  const { id } = useParams();
  const [story, setStory] = useState<Story | null>(null);
  const [showEn, setShowEn] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [voices, setVoices] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [playingIdx, setPlayingIdx] = useState(-1);
  const playingRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    api.story(id).then(setStory).catch(() => setStory(null));
    getVoices().then(setVoices);
    return () => {
      playingRef.current = false;
      stopSpeaking();
    };
  }, [id]);

  // Assign each distinct speaker its own voice (cycles if there are more
  // speakers than installed voices) and a consistent colour.
  const speakerMeta = useMemo(() => {
    const meta: Record<string, { voice?: string; color: string }> = {};
    if (!story) return meta;
    const speakers = Array.from(new Set(story.lines.map((l) => l.speaker)));
    speakers.forEach((sp, i) => {
      meta[sp] = {
        voice: voices.length ? voices[i % voices.length] : undefined,
        color: SPEAKER_COLORS[i % SPEAKER_COLORS.length],
      };
    });
    return meta;
  }, [story, voices]);

  if (!story) return <Loading what="story" />;

  const stop = () => {
    playingRef.current = false;
    stopSpeaking();
    setPlaying(false);
    setPlayingIdx(-1);
  };

  const playAll = async () => {
    if (playing) return stop();
    playingRef.current = true;
    setPlaying(true);
    const items =
      story.type === "conversation"
        ? story.lines.map((l, idx) => ({ text: l.pt, voice: speakerMeta[l.speaker]?.voice, idx }))
        : story.paragraphs.map((p, idx) => ({ text: p.pt, voice: undefined as string | undefined, idx }));
    for (const it of items) {
      if (!playingRef.current) break;
      setPlayingIdx(it.idx);
      // eslint-disable-next-line no-await-in-loop
      await speak(it.text, 1, it.voice);
      if (!playingRef.current) break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 250));
    }
    setPlaying(false);
    setPlayingIdx(-1);
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
          <button className={`btn ${playing ? "rec" : ""}`} onClick={playAll}>
            {playing ? "■ Stop" : "▶️ Play all"}
          </button>
          <button className="btn ghost" onClick={() => setShowEn((s) => !s)}>
            {showEn ? "Hide" : "Show"} English
          </button>
        </div>
      </div>

      {!showEn && (
        <div className="banner small">
          👂 Translations are hidden — try to understand using the <strong>glossary</strong> below.
          Use “Show English” only if you get stuck.
        </div>
      )}

      {story.type === "conversation" ? (
        <div className="card">
          {story.lines.map((l, i) => {
            const meta = speakerMeta[l.speaker];
            return (
              <div
                key={i}
                className="line"
                style={playingIdx === i ? { background: "#eef6ff", borderRadius: 8 } : undefined}
              >
                <div className="speaker" style={{ color: meta?.color }}>{l.speaker}</div>
                <div style={{ flex: 1 }}>
                  <div className="pt">
                    {l.pt} <SpeakButton text={l.pt} voice={meta?.voice} />
                  </div>
                  {showEn && <div className="en">{l.en}</div>}
                  {l.note && <div className="small muted">💡 {l.note}</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card stack">
          {story.paragraphs.map((p, i) => (
            <div
              key={i}
              style={playingIdx === i ? { background: "#eef6ff", borderRadius: 8, padding: 4 } : undefined}
            >
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
