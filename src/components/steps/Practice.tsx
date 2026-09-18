"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Kapi from "@/components/Kapi";
import RhythmBars from "@/components/RhythmBars";
import { Meter, ScoreRing, Speech } from "@/components/ui";
import { PHRASE_SETS } from "@/lib/content";
import { Recorder, decodeToMono, base64ToBytes, playBase64 } from "@/lib/audio";
import { transcribeOnce } from "@/lib/realtime";
import { envelope } from "@/lib/score";
import { useApp } from "@/lib/store";
import type { KapiMood, Phrase, PracticeScore, WordStamp } from "@/lib/types";

type Target = {
  audio: string;
  envelope: number[];
  duration: number;
  stamps: WordStamp[] | null;
};

type Phase = "idle" | "loading" | "playing" | "recording" | "scoring" | "scored";

export default function Practice() {
  const { learnerId, voiceId, caps, next } = useApp();
  const [setIdx, setSetIdx] = useState(0);
  const [phrase, setPhrase] = useState<Phrase>(PHRASE_SETS[0].phrases[0]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [target, setTarget] = useState<Target | null>(null);
  const [score, setScore] = useState<PracticeScore | null>(null);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<Recorder | null>(null);
  const raf = useRef<number>(0);

  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      recorder.current?.stop();
    },
    [],
  );

  /** Switching phrases throws away the cached target audio and the last score. */
  function choose(p: Phrase) {
    if (p.id === phrase.id) return;
    cancelAnimationFrame(raf.current);
    recorder.current?.stop();
    recorder.current = null;
    setPhrase(p);
    setTarget(null);
    setScore(null);
    setPhase("idle");
    setError(null);
    setLevel(0);
  }

  /** Fetch the phrase in the learner's own cloned voice, with word timestamps. */
  async function loadTarget(): Promise<Target> {
    if (target) return target;
    setPhase("loading");
    const res = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: phrase.hanzi,
        tags: phrase.tags,
        voice: voiceId,
        timestamps: true,
      }),
    });
    const data = (await res.json()) as {
      audio?: string;
      timestamps?: WordStamp[] | null;
      error?: string;
    };
    if (!data.audio) throw new Error(data.error ?? "Synthesis failed");

    const bytes = base64ToBytes(data.audio);
    const { samples, duration } = await decodeToMono(
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer,
    );
    const loaded: Target = {
      audio: data.audio,
      envelope: envelope(samples),
      duration,
      stamps: data.timestamps ?? null,
    };
    setTarget(loaded);
    return loaded;
  }

  async function hear() {
    try {
      setError(null);
      const t = await loadTarget();
      setPhase("playing");
      const el = await playBase64(t.audio);
      el.onended = () => setPhase("idle");
    } catch (err) {
      setError((err as Error).message);
      setPhase("idle");
    }
  }

  async function startAttempt() {
    try {
      setError(null);
      await loadTarget();
      const rec = new Recorder();
      await rec.start();
      recorder.current = rec;
      setPhase("recording");
      const tick = () => {
        setLevel(rec.level);
        raf.current = requestAnimationFrame(tick);
      };
      raf.current = requestAnimationFrame(tick);
    } catch (err) {
      setError((err as Error).message);
      setPhase("idle");
    }
  }

  async function finishAttempt() {
    cancelAnimationFrame(raf.current);
    const rec = recorder.current;
    const t = target;
    if (!rec || !t) return;
    const samples = rec.stop();
    recorder.current = null;
    setLevel(0);
    setPhase("scoring");

    try {
      // higgs-stt-3.1 only exists inside a Realtime session, so we open a short
      // manual-turn one purely to transcribe the attempt.
      let heard = "";
      if (caps.boson) {
        heard = await transcribeOnce(samples, "zh").catch(() => "");
      } else {
        // Demo mode: pretend they dropped one character.
        const chars = [...phrase.hanzi];
        chars.splice(Math.floor(chars.length / 2), 1);
        heard = chars.join("");
      }

      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId,
          phraseId: phrase.id,
          target: phrase.hanzi,
          heard,
          targetEnvelope: t.envelope,
          userEnvelope: envelope(samples),
          targetDuration: t.duration,
          userDuration: samples.length / 24000,
          stamps: t.stamps,
        }),
      });
      const data = (await res.json()) as PracticeScore & { error?: string };
      if (data.error) throw new Error(data.error);
      setScore(data);
      setPhase("scored");
    } catch (err) {
      setError((err as Error).message);
      setPhase("idle");
    }
  }

  const mood: KapiMood =
    phase === "recording"
      ? "listening"
      : phase === "scoring" || phase === "loading"
        ? "thinking"
        : phase === "scored"
          ? score && score.band === "nailed"
            ? "cheering"
            : "encouraging"
          : "idle";

  const kapiLine =
    phase === "recording"
      ? "Go on — say it back to me."
      : phase === "scoring"
        ? "Listening to how you said it…"
        : phase === "scored" && score
          ? score.tip
          : phase === "loading"
            ? "Getting your voice ready…"
            : "Hear it first. Then say it back.";

  const set = PHRASE_SETS[setIdx];
  const busy = phase === "loading" || phase === "scoring";

  return (
    <div className="mx-auto max-w-3xl px-6 pt-6 pb-16">
      <div className="flex items-start gap-4">
        <Kapi mood={mood} size={126} level={level} />
        <div className="pt-6">
          <AnimatePresence mode="wait">
            <Speech key={kapiLine}>{kapiLine}</Speech>
          </AnimatePresence>
        </div>
      </div>

      {/* phrase set tabs */}
      <div className="mt-7 flex flex-wrap gap-2">
        {PHRASE_SETS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => {
              setSetIdx(i);
              choose(s.phrases[0]);
            }}
            className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              i === setIdx
                ? "bg-ink text-cream"
                : "bg-paper text-mist hover:text-ink"
            }`}
          >
            {s.emoji} {s.title}
            <span className="han ml-1.5 opacity-70">{s.titleZh}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm font-semibold text-mist">{set.blurb}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {set.phrases.map((p) => (
          <button
            key={p.id}
            onClick={() => choose(p)}
            className={`han rounded-2xl px-3.5 py-2 text-lg font-bold transition-all ${
              p.id === phrase.id
                ? "bg-persimmon text-white shadow-soft"
                : "bg-paper text-ink hover:bg-cream-deep"
            }`}
          >
            {p.hanzi}
          </button>
        ))}
      </div>

      <motion.div
        key={phrase.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card mt-5"
      >
        <p className="han text-4xl font-black leading-snug">{phrase.hanzi}</p>
        <p className="mt-2 text-lg font-bold text-capy">{phrase.pinyin}</p>
        <p className="mt-1 font-semibold text-mist">{phrase.english}</p>
        {phrase.note && (
          <p className="mt-3 border-l-4 border-blush pl-3 text-sm font-semibold italic text-mist">
            {phrase.note}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={hear}
            disabled={phase === "recording" || busy}
            className="btn btn-ghost"
          >
            ▶ Hear it in your voice
          </button>
          {phase !== "recording" ? (
            <button onClick={startAttempt} disabled={busy} className="btn btn-primary">
              ● Your turn
            </button>
          ) : (
            <button onClick={finishAttempt} className="btn btn-jade">
              Done ✓
            </button>
          )}
        </div>
      </motion.div>

      {error && (
        <p className="mt-4 rounded-2xl bg-persimmon-soft px-4 py-3 text-sm font-bold text-persimmon">
          {error}
        </p>
      )}

      <AnimatePresence>
        {phase === "scored" && score && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card mt-5"
          >
            <div className="flex items-center gap-5">
              <ScoreRing value={score.overall} />
              <div className="flex flex-1 gap-4">
                <Meter label="Words" value={score.accuracy} hint="did they land" />
                <Meter label="Rhythm" value={score.rhythm} hint="stress & flow" />
                <Meter label="Pace" value={score.pace} hint="speed vs target" />
              </div>
            </div>

            {score.heard && (
              <p className="mt-4 text-sm font-semibold text-mist">
                Kapi heard:{" "}
                <span className="han text-base text-ink">{score.heard}</span>
              </p>
            )}

            <div className="mt-5">
              <RhythmBars score={score} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 flex justify-center">
        <button onClick={next} className="btn btn-ghost">
          I&rsquo;m ready to talk to someone →
        </button>
      </div>
    </div>
  );
}
