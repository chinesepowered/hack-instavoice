"use client";

import { create } from "zustand";

export type Capabilities = { boson: boolean; db: boolean; insta: boolean };

export type Step = "welcome" | "clone" | "mirror" | "practice" | "scenario" | "finale";

export const STEPS: Step[] = [
  "welcome",
  "clone",
  "mirror",
  "practice",
  "scenario",
  "finale",
];

type State = {
  step: Step;
  learnerId: string | null;
  branch: string | null;
  voiceId: string | null;
  caps: Capabilities;
  go: (step: Step) => void;
  next: () => void;
  setSession: (v: {
    learnerId: string;
    branch: string | null;
    caps: Capabilities;
  }) => void;
  setVoice: (voiceId: string) => void;
};

export const useApp = create<State>((set, get) => ({
  step: "welcome",
  learnerId: null,
  branch: null,
  voiceId: null,
  caps: { boson: false, db: false, insta: false },
  go: (step) => set({ step }),
  next: () => {
    const i = STEPS.indexOf(get().step);
    set({ step: STEPS[Math.min(STEPS.length - 1, i + 1)] });
  },
  setSession: ({ learnerId, branch, caps }) => set({ learnerId, branch, caps }),
  setVoice: (voiceId) => set({ voiceId }),
}));

export const demoMode = () => !useApp.getState().caps.boson;
