// Shared types mirroring the backend content schemas.

export type Level = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface Example {
  pt: string;
  en: string;
  note?: string;
}

export interface Mistake {
  wrong: string;
  right: string;
  note?: string;
}

export interface GrammarSection {
  heading: string;
  body: string;
  examples: Example[];
}

export interface GrammarLesson {
  id: string;
  level: Level;
  order: number;
  title: string;
  titlePt?: string;
  summary: string;
  tags: string[];
  sections: GrammarSection[];
  keyPoints: string[];
  commonMistakes: Mistake[];
  relatedVocab: string[];
  quizId?: string | null;
}

export interface VocabCard {
  id: string;
  pt: string;
  en: string;
  pos?: string;
  gender?: string | null;
  ipa?: string;
  example?: Example | null;
  tags: string[];
}

export interface VocabDeck {
  id: string;
  level: Level;
  title: string;
  theme: string;
  description: string;
  cards: VocabCard[];
}

export interface DialogueLine {
  speaker: string;
  pt: string;
  en: string;
  note?: string;
}

export interface Paragraph {
  pt: string;
  en: string;
}

export interface GlossaryItem {
  pt: string;
  en: string;
  note?: string;
}

export interface ComprehensionQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}

export interface Story {
  id: string;
  level: Level;
  type: "story" | "conversation";
  title: string;
  titlePt?: string;
  summary: string;
  lines: DialogueLine[];
  paragraphs: Paragraph[];
  glossary: GlossaryItem[];
  comprehension: ComprehensionQuestion[];
}

export type QuestionType =
  | "multiple_choice"
  | "fill_blank"
  | "translate_pt_en"
  | "translate_en_pt"
  | "listening";

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  promptPt?: string;
  options: string[];
  answer: string;
  explanation?: string;
  hint?: string;
  audioText?: string;
}

export interface Quiz {
  id: string;
  level: Level;
  title: string;
  topic: string;
  description: string;
  questions: Question[];
}

export interface ContentSummary {
  id: string;
  level: Level;
  title: string;
  kind: string;
  subtitle?: string;
  count?: number;
  tags: string[];
}

export interface LevelInfo {
  level: Level;
  name: string;
  grammar: number;
  vocab: number;
  stories: number;
  quizzes: number;
}

// Pronunciation assessment result.
export interface WordToken {
  expected: string | null;
  heard: string | null;
  status: "correct" | "substituted" | "missing" | "extra";
  index: number | null;
}

export interface PhonemeError {
  expected: string | null;
  heard: string | null;
  type: string;
}

export interface Assessment {
  target: string;
  transcript: string;
  score: number;
  verdict: string;
  similarity: number;
  mean_confidence: number | null;
  words: {
    tokens: WordToken[];
    correct: number;
    substituted: number;
    missing: number;
    extra: number;
    target_word_count: number;
    word_accuracy: number;
  };
  phonemes: {
    reference: string[];
    hypothesis: string[];
    correct: number;
    substituted: number;
    missing: number;
    extra: number;
    errors: PhonemeError[];
    phoneme_accuracy: number;
    source: string;
  } | null;
  reference_ipa: string | null;
  acoustic_phonemes: string | null;
  tips: string[];
}

export interface SystemStatus {
  content: Record<string, unknown>;
  levels: { level: Level; name: string }[];
  tts: { available: boolean; engine: string; voice: string | null; reason: string | null };
  asr: { available: boolean; engine: string; model: string; device: string; reason: string | null };
}
