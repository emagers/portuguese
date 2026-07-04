// Thin API client for the local FastAPI backend. All calls go through the Vite
// proxy at /api, so everything stays on localhost.
import type {
  Assessment,
  ContentSummary,
  GrammarLesson,
  LevelInfo,
  Quiz,
  Story,
  SystemStatus,
  VocabDeck,
} from "../types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  systemStatus: () => get<SystemStatus>("/system/status"),
  levels: () => get<LevelInfo[]>("/content/levels"),

  grammarList: (level?: string) =>
    get<ContentSummary[]>(`/content/grammar${level ? `?level=${level}` : ""}`),
  grammar: (id: string) => get<GrammarLesson>(`/content/grammar/${id}`),

  vocabList: (level?: string) =>
    get<ContentSummary[]>(`/content/vocab${level ? `?level=${level}` : ""}`),
  vocab: (id: string) => get<VocabDeck>(`/content/vocab/${id}`),

  storyList: (level?: string) =>
    get<ContentSummary[]>(`/content/stories${level ? `?level=${level}` : ""}`),
  story: (id: string) => get<Story>(`/content/stories/${id}`),

  quizList: (level?: string) =>
    get<ContentSummary[]>(`/content/quizzes${level ? `?level=${level}` : ""}`),
  quiz: (id: string) => get<Quiz>(`/content/quizzes/${id}`),

  // Progress
  progressSummary: () => get<any>("/progress/summary"),
  reviewCard: (card_id: string, deck_id: string, grade: number) =>
    post<any>("/progress/vocab/review", { card_id, deck_id, grade }),
  saveQuiz: (
    quiz_id: string,
    level: string,
    score: number,
    total: number,
    details?: unknown,
  ) => post<any>("/progress/quiz", { quiz_id, level, score, total, details }),
  markLesson: (lesson_id: string, status = "completed") =>
    post<any>("/progress/lesson", { lesson_id, status }),
  markDeck: (deck_id: string, status = "completed") =>
    post<any>("/progress/deck", { deck_id, status }),
  quizHistory: () => get<any[]>("/progress/quiz/history"),
  pronunciationHistory: () => get<any[]>("/progress/pronunciation/history"),

  // Pronunciation
  pronunciationStatus: () => get<any>("/pronunciation/status"),
  assess: async (targetText: string, blob: Blob): Promise<Assessment> => {
    const form = new FormData();
    form.append("target_text", targetText);
    form.append("audio", blob, "recording.webm");
    const res = await fetch("/api/pronunciation/assess", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(detail.detail || res.statusText);
    }
    return res.json();
  },
};
