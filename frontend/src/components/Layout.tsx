import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const links = [
  { to: "/", label: "Dashboard", ico: "🏠", end: true },
  { to: "/grammar", label: "Grammar", ico: "📖" },
  { to: "/vocab", label: "Vocabulary", ico: "🗂️" },
  { to: "/stories", label: "Stories & Talk", ico: "💬" },
  { to: "/quizzes", label: "Knowledge Tests", ico: "✅" },
  { to: "/listening", label: "Listening", ico: "🎧" },
  { to: "/pronunciation", label: "Pronunciation", ico: "🎙️" },
  { to: "/reinforcement", label: "Reinforcement", ico: "🔁" },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span>🇧🇷</span>
          <div>
            Aprender Português
            <small>Brazilian Portuguese tutor</small>
          </div>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}>
              <span className="ico">{l.ico}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
