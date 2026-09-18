"use client";

import { motion } from "motion/react";
import type { PracticeScore } from "@/lib/types";

/**
 * The centrepiece visual. Boson has no pronunciation-scoring endpoint, but word
 * timestamps plus an energy envelope give us the thing that actually makes a
 * heritage speaker sound foreign: rhythm. Target on top, learner mirrored below.
 */
export default function RhythmBars({ score }: { score: PracticeScore }) {
  const { targetEnvelope: target, userEnvelope: user } = score;
  const tone =
    score.band === "nailed"
      ? "#4da88a"
      : score.band === "close"
        ? "#f5b93f"
        : "#e8663f";

  return (
    <div className="space-y-4">
      <div className="rounded-[1.75rem] bg-cream-deep/55 px-5 py-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="pill bg-capy-soft text-capy-deep">
            你的目标 · your voice, correct
          </span>
        </div>

        <div className="flex h-20 items-end gap-[2px]">
          {target.map((v, i) => (
            <motion.div
              key={`t${i}`}
              className="flex-1 rounded-t-full bg-capy"
              initial={{ height: 2 }}
              animate={{ height: `${Math.max(3, v * 100)}%` }}
              transition={{
                delay: i * 0.004,
                type: "spring",
                stiffness: 240,
                damping: 20,
              }}
            />
          ))}
        </div>

        <div className="my-2 h-px bg-capy-soft" />

        <div className="flex h-20 items-start gap-[2px]">
          {user.map((v, i) => (
            <motion.div
              key={`u${i}`}
              className="flex-1 rounded-b-full"
              style={{ backgroundColor: tone }}
              initial={{ height: 2 }}
              animate={{ height: `${Math.max(3, v * 100)}%` }}
              transition={{
                delay: 0.18 + i * 0.004,
                type: "spring",
                stiffness: 240,
                damping: 20,
              }}
            />
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <span className="pill" style={{ background: `${tone}22`, color: tone }}>
            你说的 · what you said
          </span>
        </div>
      </div>

      {score.words.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {score.words.map((w, i) => (
            <motion.span
              key={`${w.word}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.03 }}
              title={`drift ${(w.drift * 100).toFixed(0)}%`}
              className={`han rounded-xl px-2.5 py-1 text-lg font-medium ${
                w.ok
                  ? "bg-jade-soft text-jade"
                  : "bg-persimmon-soft text-persimmon"
              }`}
            >
              {w.word}
            </motion.span>
          ))}
        </div>
      )}
    </div>
  );
}
