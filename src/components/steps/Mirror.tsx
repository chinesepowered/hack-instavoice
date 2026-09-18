"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Kapi from "@/components/Kapi";
import { Speech } from "@/components/ui";
import { MIRROR_LINE } from "@/lib/content";
import { playBase64 } from "@/lib/audio";
import { useApp } from "@/lib/store";

/** The reveal. Everything before this is setup; this is the thirty seconds people remember. */
export default function Mirror() {
  const { voiceId, next } = useApp();
  const [phase, setPhase] = useState<"loading" | "ready" | "played">("loading");
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: MIRROR_LINE.hanzi,
            tags: MIRROR_LINE.tags,
            voice: voiceId,
          }),
        });
        const data = (await res.json()) as { audio?: string; error?: string };
        if (cancelled) return;
        if (!data.audio) throw new Error(data.error ?? "Synthesis failed");
        audio.current = data.audio;
        setPhase("ready");
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [voiceId]);

  async function play() {
    if (!audio.current) return;
    await playBase64(audio.current);
    setPhase("played");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pt-6">
      <div className="flex flex-col items-center">
        <Kapi mood={phase === "played" ? "happy" : "thinking"} size={150} />
        <AnimatePresence mode="wait">
          <Speech key={phase}>
            {phase === "loading" && "Teaching your voice some Mandarin…"}
            {phase === "ready" && "Okay. Press it. This is you."}
            {phase === "played" && "That was your voice. You've always had it."}
          </Speech>
        </AnimatePresence>
      </div>

      <motion.div
        className="card mt-8 text-center"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 18 }}
      >
        <p className="han text-4xl font-black leading-snug text-ink">
          {MIRROR_LINE.hanzi}
        </p>
        <p className="mt-3 text-base font-bold text-capy">{MIRROR_LINE.pinyin}</p>
        <p className="mt-1 text-sm font-semibold text-mist">{MIRROR_LINE.english}</p>
      </motion.div>

      {error && (
        <p className="mt-4 rounded-2xl bg-persimmon-soft px-4 py-3 text-center text-sm font-bold text-persimmon">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          onClick={play}
          disabled={phase === "loading"}
          className="btn btn-primary px-12 py-5 text-xl"
        >
          {phase === "loading" ? "…" : phase === "ready" ? "▶  Hear yourself" : "▶  Again"}
        </button>

        {phase === "played" && (
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={next}
            className="btn btn-ghost"
          >
            Now teach me to say it →
          </motion.button>
        )}
      </div>
    </div>
  );
}
