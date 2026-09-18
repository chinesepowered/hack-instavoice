export type Phrase = {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  /** Why this line matters — shown under the card. */
  note?: string;
  /** Inline Higgs TTS tags that shape delivery, e.g. "<|emotion:affection|>". */
  tags?: string;
};

export type PhraseSet = {
  id: string;
  title: string;
  titleZh: string;
  emoji: string;
  blurb: string;
  phrases: Phrase[];
};

export type Scenario = {
  id: string;
  title: string;
  titleZh: string;
  emoji: string;
  partner: string;
  partnerZh: string;
  /** Preset Higgs voice for the other side of the conversation. */
  voice: string;
  blurb: string;
  /** Difficulty 1-3, drives how much English the partner falls back on. */
  heat: 1 | 2 | 3;
  instructions: string;
  opener: string;
};

export type WordStamp = { word: string; start: number; end: number };

export type SpeechResult = {
  /** base64 audio in the requested container */
  audio: string;
  format: string;
  timestamps: WordStamp[] | null;
};

export type ScoreBand = "nailed" | "close" | "keep-going";

export type WordScore = {
  word: string;
  /** seconds the learner's rendering drifted from the target window */
  drift: number;
  ok: boolean;
};

export type PracticeScore = {
  overall: number;
  accuracy: number;
  rhythm: number;
  pace: number;
  band: ScoreBand;
  words: WordScore[];
  heard: string;
  target: string;
  tip: string;
  /** normalized 0-1 energy envelopes, for the rhythm bars */
  targetEnvelope: number[];
  userEnvelope: number[];
};

export type KapiMood =
  | "idle"
  | "listening"
  | "thinking"
  | "happy"
  | "cheering"
  | "encouraging"
  | "sleepy";
