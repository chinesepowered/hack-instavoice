"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import Kapi from "@/components/Kapi";
import { Speech } from "@/components/ui";
import { SCENARIOS } from "@/lib/content";
import { Recorder } from "@/lib/audio";
import { RealtimeSession, type Turn } from "@/lib/realtime";
import { useApp } from "@/lib/store";
import type { KapiMood, Scenario as ScenarioT } from "@/lib/types";

export default function Scenario() {
  const { caps, next } = useApp();
  const [picked, setPicked] = useState<ScenarioT | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "live" | "ended">("idle");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [theySpeak, setTheySpeak] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const session = useRef<RealtimeSession | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const raf = useRef<number>(0);
  const scroller = useRef<HTMLDivElement>(null);

  const teardown = useCallback(() => {
    cancelAnimationFrame(raf.current);
    recorder.current?.stop();
    recorder.current = null;
    session.current?.close();
    session.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [turns]);

  async function begin(scenario: ScenarioT) {
    setPicked(scenario);
    setTurns([]);
    setHint(null);
    setError(null);

    if (!caps.boson) {
      setError(
        "Live conversation needs a Boson API key — add BOSON_API_KEY and this scenario comes alive.",
      );
      setStatus("idle");
      return;
    }

    setStatus("connecting");
    try {
      const s = new RealtimeSession({
        onTurn: (turn) =>
          setTurns((prev) => {
            const i = prev.findIndex((t) => t.id === turn.id);
            if (i === -1) return [...prev, turn];
            const copy = [...prev];
            copy[i] = turn;
            return copy;
          }),
        onStruggle: (h) => {
          setHint(h);
          setTimeout(() => setHint(null), 9000);
        },
        onSpeakingChange: setTheySpeak,
        onError: (m) => setError(m),
        onClose: () => setStatus("ended"),
      });
      await s.connect({
        instructions: scenario.instructions,
        voice: scenario.voice,
        opener: scenario.opener,
        language: "zh",
      });
      session.current = s;

      const rec = new Recorder();
      await rec.start();
      rec.onChunk((chunk) => s.pushAudio(chunk));
      recorder.current = rec;

      const tick = () => {
        setLevel(rec.level);
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
      setStatus("live");
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
      teardown();
    }
  }

  function hangUp() {
    teardown();
    setStatus("ended");
    setTheySpeak(false);
  }

  const mood: KapiMood = hint
    ? "encouraging"
    : status === "connecting"
      ? "thinking"
      : status === "live"
        ? theySpeak
          ? "idle"
          : "listening"
        : "idle";

  if (!picked || status === "idle") {
    return (
      <div className="mx-auto max-w-3xl px-6 pt-6 pb-16">
        <div className="flex items-start gap-4">
          <Kapi mood="idle" size={120} />
          <div className="pt-5">
            <Speech>Pick someone to talk to. I&rsquo;ll stay right here.</Speech>
          </div>
        </div>

        {error && (
          <p className="mt-5 rounded-2xl bg-persimmon-soft px-4 py-3 text-sm font-bold text-persimmon">
            {error}
          </p>
        )}

        <div className="mt-7 grid gap-4 sm:grid-cols-3">
          {SCENARIOS.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -5 }}
              onClick={() => begin(s)}
              className="card text-left"
            >
              <div className="text-4xl">{s.emoji}</div>
              <p className="mt-3 text-lg font-black leading-tight">{s.title}</p>
              <p className="han text-sm font-bold text-persimmon">{s.titleZh}</p>
              <p className="mt-2 text-sm font-semibold leading-snug text-mist">
                {s.blurb}
              </p>
              <div className="mt-3 flex items-center gap-1">
                {[1, 2, 3].map((h) => (
                  <span
                    key={h}
                    className={`h-1.5 w-6 rounded-full ${
                      h <= s.heat ? "bg-persimmon" : "bg-cream-deep"
                    }`}
                  />
                ))}
              </div>
            </motion.button>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button onClick={next} className="btn btn-ghost">
            Skip to the last part →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pt-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-black">
            {picked.emoji} {picked.partner}
            <span className="han ml-2 text-persimmon">{picked.partnerZh}</span>
          </p>
          <p className="text-sm font-semibold text-mist">{picked.blurb}</p>
        </div>
        <span
          className={`pill ${
            status === "live"
              ? "bg-jade-soft text-jade"
              : status === "connecting"
                ? "bg-cream-deep text-mist"
                : "bg-persimmon-soft text-persimmon"
          }`}
        >
          {status === "live" ? "● live" : status === "connecting" ? "connecting…" : "ended"}
        </span>
      </div>

      <div className="mt-5 flex gap-4">
        <div className="shrink-0">
          <Kapi mood={mood} size={112} level={level} />
          <AnimatePresence>
            {hint && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-1 max-w-[9rem] rounded-2xl bg-yuzu/25 px-3 py-2 text-[13px] font-bold leading-snug text-ink"
              >
                💡 {hint}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div
          ref={scroller}
          className="card max-h-[26rem] flex-1 space-y-3 overflow-y-auto"
        >
          {turns.length === 0 && (
            <p className="py-10 text-center text-sm font-semibold text-mist">
              {status === "connecting"
                ? "Connecting…"
                : "Say something. Anything. 你好 counts."}
            </p>
          )}
          {turns.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${t.who === "you" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`han max-w-[78%] rounded-3xl px-4 py-2.5 text-lg font-medium leading-snug ${
                  t.who === "you"
                    ? "bg-persimmon text-white"
                    : "bg-cream-deep text-ink"
                }`}
              >
                {t.text || "…"}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-persimmon-soft px-4 py-3 text-sm font-bold text-persimmon">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-center gap-3">
        {status === "live" ? (
          <button onClick={hangUp} className="btn btn-ghost">
            End conversation
          </button>
        ) : (
          <>
            <button onClick={() => begin(picked)} className="btn btn-primary">
              Try again
            </button>
            <button
              onClick={() => {
                setPicked(null);
                setStatus("idle");
              }}
              className="btn btn-ghost"
            >
              Someone else
            </button>
          </>
        )}
        <button onClick={next} className="btn btn-ghost">
          Last part →
        </button>
      </div>
    </div>
  );
}
