import { speak } from "../api/audio";
import type { Level } from "../types";

const LEVELS: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function SpeakButton({ text, rate = 1, voice }: { text: string; rate?: number; voice?: string }) {
  return (
    <button
      className="speak"
      title="Listen (Brazilian Portuguese)"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        speak(text, rate, voice);
      }}
    >
      🔊
    </button>
  );
}

export function LevelFilter({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="level-filter">
      <button
        className={`level-pill ${value === null ? "active" : ""}`}
        onClick={() => onChange(null)}
      >
        All
      </button>
      {LEVELS.map((l) => (
        <button
          key={l}
          className={`level-pill ${value === l ? "active" : ""}`}
          onClick={() => onChange(l)}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function LevelBadge({ level }: { level: string }) {
  return <span className="badge blue">{level}</span>;
}

export function Loading({ what = "content" }: { what?: string }) {
  return <div className="loading">Loading {what}…</div>;
}

export function ErrorBox({ msg }: { msg: string }) {
  return <div className="banner err">⚠️ {msg}</div>;
}
