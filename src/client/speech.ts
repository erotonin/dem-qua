// Minimal typing for the Web Speech API, which TypeScript's DOM lib does not ship.
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface Dictation {
  start(): void;
  stop(): void;
}

export interface DictationHandlers {
  onText(finalText: string, interimText: string): void;
  onEnd(): void;
  onError(code: string): void;
}

/**
 * Vietnamese dictation via the browser. Works well in Chrome/Android; Safari
 * support is partial, so a server-side speech-to-text fallback is planned.
 */
export function createDictation(handlers: DictationHandlers): Dictation | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = "vi-VN";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (!result) continue;
      if (result.isFinal) finalText += result[0].transcript;
      else interimText += result[0].transcript;
    }
    handlers.onText(finalText, interimText);
  };
  recognition.onend = () => handlers.onEnd();
  recognition.onerror = (event) => handlers.onError(event.error);

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
  };
}
