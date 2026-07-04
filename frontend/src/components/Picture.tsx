import { useEffect, useState } from "react";

// Renders a "picture" for an emoji using the locally-bundled OpenMoji SVGs
// (downloaded by scripts/download_emoji.py). Falls back to the system emoji
// glyph if no SVG is available, so the UI always shows something.

let manifestCache: Record<string, string> | null = null;
let manifestPromise: Promise<Record<string, string>> | null = null;

function loadManifest(): Promise<Record<string, string>> {
  if (manifestCache) return Promise.resolve(manifestCache);
  if (!manifestPromise) {
    manifestPromise = fetch("/openmoji/manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Record<string, string>) => {
        manifestCache = m;
        return m;
      })
      .catch(() => {
        manifestCache = {};
        return {};
      });
  }
  return manifestPromise;
}

export default function Picture({
  emoji,
  size = 96,
}: {
  emoji: string;
  size?: number;
}) {
  const [file, setFile] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadManifest().then((m) => {
      if (active) setFile(m[emoji] ?? null);
    });
    return () => {
      active = false;
    };
  }, [emoji]);

  if (file && !failed) {
    return (
      <img
        src={`/openmoji/${file}`}
        alt={emoji}
        width={size}
        height={size}
        style={{ display: "inline-block", verticalAlign: "middle" }}
        onError={() => setFailed(true)}
      />
    );
  }
  // Fallback: render the system emoji at a comparable size.
  return (
    <span style={{ fontSize: size * 0.8, lineHeight: 1 }} role="img" aria-label={emoji}>
      {emoji}
    </span>
  );
}
