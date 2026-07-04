import type { ReactNode } from "react";
import { speak } from "../api/audio";

// Minimal, safe markdown renderer for lesson bodies. Supports **bold**,
// `inline code`, pipe tables, and paragraphs. Outputs React nodes (no HTML
// injection). Content is local and authored, so scope is intentionally small.

function stripMd(text: string): string {
  return text.replace(/\*\*/g, "").replace(/`/g, "").trim();
}

function inline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on **bold** and `code` while keeping delimiters.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  parts.forEach((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{p.slice(2, -2)}</strong>);
    } else if (/^`[^`]+`$/.test(p)) {
      nodes.push(<code key={`${keyBase}-c${i}`}>{p.slice(1, -1)}</code>);
    } else if (p) {
      nodes.push(<span key={`${keyBase}-t${i}`}>{p}</span>);
    }
  });
  return nodes;
}

function isTableRow(line: string) {
  return line.trim().startsWith("|");
}
function isSeparator(line: string) {
  return /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes("-");
}
function cells(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

export default function Markdown({ text }: { text: string }) {
  const lines = (text || "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      const joined = para.join(" ");
      blocks.push(<p key={`p${blocks.length}`}>{inline(joined, `p${blocks.length}`)}</p>);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    if (isTableRow(line) && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      flushPara();
      const header = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      blocks.push(
        <table key={`tbl${blocks.length}`}>
          <thead>
            <tr>
              {header.map((h, hi) => (
                <th key={hi}>{inline(h, `h${hi}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => {
                  const spoken = stripMd(c);
                  const clickable = spoken.length > 0;
                  return (
                    <td
                      key={ci}
                      onClick={clickable ? () => speak(spoken) : undefined}
                      className={clickable ? "speak-cell" : undefined}
                      title={clickable ? "Click to listen 🔊" : undefined}
                    >
                      {inline(c, `r${ri}c${ci}`)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }
    if (line.trim() === "") {
      flushPara();
    } else {
      para.push(line.trim());
    }
    i++;
  }
  flushPara();
  return <div className="prose">{blocks}</div>;
}
