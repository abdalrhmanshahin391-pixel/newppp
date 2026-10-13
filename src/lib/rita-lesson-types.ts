/** Who has the turn right now. Drives the voice status bar. */
export type Phase =
  "connecting" | "listening" | "understanding" | "preparing" | "speaking" | "muted";

/** One chat message. `text` is raw model or transcript text; it is cleaned when displayed. */
export type LessonMessage = {
  id: string;
  role: "you" | "rita";
  text: string;
  createdAt?: number;
  /** The reply is still being generated or spoken. */
  streaming?: boolean;
  /** The learner cut Rita off; the text is only what was heard. */
  interrupted?: boolean;
  /** Links to a correction card shown under this message. */
  correctionId?: string;
};
