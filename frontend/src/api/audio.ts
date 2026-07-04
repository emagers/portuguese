// Audio helpers: play Brazilian Portuguese TTS (Piper via backend, with a
// browser SpeechSynthesis fallback) and record microphone audio for
// pronunciation assessment.

let ttsAvailable: boolean | null = null;

export async function checkTts(): Promise<boolean> {
  if (ttsAvailable !== null) return ttsAvailable;
  try {
    const res = await fetch("/api/tts/status");
    const j = await res.json();
    ttsAvailable = !!j.available;
  } catch {
    ttsAvailable = false;
  }
  return ttsAvailable;
}

let currentAudio: HTMLAudioElement | null = null;

function pickBrazilianVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  return (
    voices.find((v) => v.lang?.toLowerCase() === "pt-br") ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("pt"))
  );
}

function speakWithBrowser(text: string, rate = 0.95): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) return resolve();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = rate;
    const v = pickBrazilianVoice();
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

// Warm up the voice list (some browsers load voices asynchronously).
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => pickBrazilianVoice();
}

export async function speak(text: string, rate = 1): Promise<void> {
  const t = text.trim();
  if (!t) return;
  const hasPiper = await checkTts();
  if (hasPiper) {
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
      }
      const audio = new Audio(`/api/tts?text=${encodeURIComponent(t)}`);
      audio.playbackRate = rate;
      currentAudio = audio;
      await audio.play();
      return;
    } catch {
      // fall through to browser TTS
    }
  }
  await speakWithBrowser(t, rate * 0.95);
}

export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

// ---- Microphone recording ---- //
export class Recorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
    this.mediaRecorder = new MediaRecorder(
      this.stream,
      mime ? { mimeType: mime } : undefined,
    );
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return resolve(new Blob());
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, {
          type: this.mediaRecorder?.mimeType || "audio/webm",
        });
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  get recording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }
}
