"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Kapi from "@/components/Kapi";
import { Speech } from "@/components/ui";
import { CLONE_SCRIPT } from "@/lib/content";
import { Recorder, bytesToBase64, encodeWav } from "@/lib/audio";
import { useApp } from "@/lib/store";
import type { KapiMood } from "@/lib/types";

/** Boson needs at least 3s of reference audio; ~15s clones noticeably better. */
const TARGET_SECONDS = 15;
const MIN_SECONDS = 4;

export default function CloneVoice() {
  const { learnerId, setVoice, next } = useApp();
  const recorder = useRef<Recorder | null>(null);
  const raf = useRef<number>(0);

  const [state, setState] = useState<"ready" | "recording" | "sending">("ready");
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(raf.current);
      recorder.current?.stop();
    };
  }, []);

  async function start() {
    setError(null);
    const rec = new Recorder();
    try {
      await rec.start();
    } catch {
      setError("Kapi can't hear your microphone. Check browser permissions?");
      return;
    }
    recorder.current = rec;
    setState("recording");

    const tick = () => {
      setSeconds(rec.seconds);
      setLevel(rec.level);
      if (rec.seconds >= TARGET_SECONDS) {
        void finish();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }

  async function finish() {
    cancelAnimationFrame(raf.current);
    const rec = recorder.current;
    if (!rec) return;
    const samples = rec.stop();
    recorder.current = null;

    if (samples.length / 24000 < MIN_SECONDS) {
      setState("ready");
      setSeconds(0);
      setError("A touch short — Kapi needs about five seconds to learn a voice.");
      return;
    }

    setState("sending");
    try {
      const wav = encodeWav(samples);
      const res = await fetch("/api/voice/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId,
          audio: bytesToBase64(wav),
          text: CLONE_SCRIPT,
        }),
      });
      const data = (await res.json()) as { voice?: string; error?: string };
      if (!res.ok || !data.voice) throw new Error(data.error ?? "Cloning failed");
      setVoice(data.voice);
      next();
    } catch (err) {
      setState("ready");
      setSeconds(0);
      setError((err as Error).message);
    }
  }

  const pct = Math.min(100, (seconds / TARGET_SECONDS) * 100);
  const mood: KapiMood =
    state === "recording" ? "listening" : state === "sending" ? "thinking" : "idle";

  return (
    <div className="mx-auto max-w-2xl px-6 pt-6">
      <div className="flex flex-col items-center">
        <Kapi mood={mood} size={168} level={level} />
        <AnimatePresence mode="wait">
          <Speech key={state}>
            {state === "ready" && "Read this out loud. Normal voice, like you're telling me something."}
            {state === "recording" && "Perfect — keep going, I'm listening…"}
            {state === "sending" && "Learning your voice… this takes a moment."}
          </Speech>
        </AnimatePresence>
      </div>

      <div className="card mt-8">
        <p className="text-xl font-bold leading-relaxed text-ink">
          &ldquo;{CLONE_SCRIPT}&rdquo;
        </p>
      </div>

      <div className="mt-6">
        <div className="h-3 overflow-hidden rounded-full bg-cream-deep">
          <motion.div
            className="h-full rounded-full bg-persimmon"
            animate={{ width: `${pct}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs font-bold text-mist">
          <span>{seconds.toFixed(1)}s</span>
          <span>{TARGET_SECONDS}s</span>
        </div>
      </div>

      {/* live level meter */}
      <div className="mt-5 flex h-14 items-center justify-center gap-1">
        {Array.from({ length: 40 }, (_, i) => {
          const dist = Math.abs(i - 19.5) / 19.5;
          const h =
            state === "recording"
              ? Math.max(4, level * 56 * (1 - dist * 0.72) * (0.65 + Math.random() * 0.7))
              : 4;
          return (
            <motion.span
              key={i}
              className="w-1.5 rounded-full bg-capy"
              animate={{ height: h }}
              transition={{ type: "spring", stiffness: 420, damping: 22 }}
            />
          );
        })}
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-persimmon-soft px-4 py-3 text-center text-sm font-bold text-persimmon">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-center gap-3">
        {state === "ready" && (
          <button onClick={start} className="btn btn-primary px-10 py-4 text-lg">
            ● Record
          </button>
        )}
        {state === "recording" && (
          <button
            onClick={finish}
            disabled={seconds < MIN_SECONDS}
            className="btn btn-jade px-10 py-4 text-lg"
          >
            {seconds < MIN_SECONDS
              ? `Keep going… ${(MIN_SECONDS - seconds).toFixed(0)}s`
              : "Done ✓"}
          </button>
        )}
        {state === "sending" && (
          <button disabled className="btn btn-ghost px-10 py-4 text-lg">
            Cloning…
          </button>
        )}
      </div>
    </div>
  );
}
