"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { KapiMood } from "@/lib/types";

/**
 * Kapi 卡皮 — a capybara who is extremely relaxed about your Mandarin.
 *
 * Capybara, not bear: the head is wider than it is tall with a flat crown, the
 * ears are small and sit out on the upper corners, and the snout is a broad
 * blunt block across the bottom half of the face with nostrils rather than a
 * button nose. Inline SVG so she can react to live audio levels.
 */

const TILT: Record<KapiMood, number> = {
  idle: 0,
  listening: -5,
  thinking: 7,
  happy: -3,
  cheering: 0,
  encouraging: 6,
  sleepy: 10,
};

const EYE_Y: Record<KapiMood, number> = {
  idle: 92,
  listening: 90,
  thinking: 87,
  happy: 91,
  cheering: 90,
  encouraging: 92,
  sleepy: 95,
};

const EYE_X = { left: 72, right: 148 };

function Eyes({ mood, blink }: { mood: KapiMood; blink: boolean }) {
  const y = EYE_Y[mood];
  const arc = mood === "happy" || mood === "cheering";
  const shut = blink || mood === "sleepy";

  if (shut || arc) {
    const d = arc ? "M -8 3 Q 0 -7 8 3" : "M -8 0 Q 0 5 8 0";
    return (
      <g stroke="#3a2c25" strokeWidth={4.5} strokeLinecap="round" fill="none">
        <path d={d} transform={`translate(${EYE_X.left} ${y})`} />
        <path d={d} transform={`translate(${EYE_X.right} ${y})`} />
      </g>
    );
  }

  const look = mood === "thinking" ? -2.5 : 0;
  return (
    <g fill="#3a2c25">
      <ellipse cx={EYE_X.left} cy={y} rx={7} ry={8} />
      <ellipse cx={EYE_X.right} cy={y} rx={7} ry={8} />
      <circle cx={EYE_X.left + 2.6} cy={y - 2.8 + look} r={2.5} fill="#fffdf9" />
      <circle cx={EYE_X.right + 2.6} cy={y - 2.8 + look} r={2.5} fill="#fffdf9" />
    </g>
  );
}

function Mouth({ mood }: { mood: KapiMood }) {
  // Capybaras have a tiny mouth tucked under a very wide snout.
  const d =
    mood === "cheering"
      ? "M 100 147 Q 110 158 120 147 Q 110 152 100 147"
      : mood === "happy"
        ? "M 102 146 Q 110 153 118 146"
        : mood === "sleepy"
          ? "M 105 147 Q 110 149 115 147"
          : "M 104 146 Q 110 151 116 146";

  return (
    <path
      d={d}
      fill={mood === "cheering" ? "#c9705c" : "none"}
      stroke="#8a6140"
      strokeWidth={2.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export default function Kapi({
  mood = "idle",
  size = 200,
  level = 0,
}: {
  mood?: KapiMood;
  size?: number;
  /** 0–1 audio level; makes her lean into sound. */
  level?: number;
}) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(
        () => {
          setBlink(true);
          setTimeout(() => setBlink(false), 130);
          loop();
        },
        2200 + Math.random() * 3200,
      );
    };
    loop();
    return () => clearTimeout(timer);
  }, []);

  const lively = Math.min(1, level * 2.2);
  const listening = mood === "listening";

  return (
    <motion.svg
      viewBox="0 0 220 200"
      width={size}
      height={size * (200 / 220)}
      role="img"
      aria-label={`Kapi the capybara, ${mood}`}
      initial={false}
      animate={{ rotate: TILT[mood] * 0.45 }}
      transition={{ type: "spring", stiffness: 160, damping: 14 }}
    >
      <AnimatePresence>
        {listening && (
          <motion.ellipse
            cx={110}
            cy={112}
            rx={92}
            ry={80}
            fill="#e8663f"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 0.1 + lively * 0.16, scale: 1 + lively * 0.12 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 210, damping: 18 }}
            style={{ transformOrigin: "110px 112px" }}
          />
        )}
      </AnimatePresence>

      <motion.g
        animate={{
          y: mood === "cheering" ? [0, -9, 0] : [0, -3.5, 0],
          scaleY: [1, 1.015, 1],
        }}
        transition={{
          duration: mood === "cheering" ? 0.62 : 3.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ transformOrigin: "110px 170px" }}
      >
        {/* barrel body, mostly hidden — capybaras are all torso */}
        <ellipse cx={110} cy={190} rx={74} ry={30} fill="#a8774b" />

        {/* ears: small, low-profile, out on the corners */}
        <motion.g
          animate={{ rotate: listening ? -16 - lively * 10 : 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 12 }}
          style={{ transformOrigin: "42px 68px" }}
        >
          <ellipse cx={42} cy={68} rx={14} ry={11} fill="#a8774b" transform="rotate(-18 42 68)" />
          <ellipse cx={43} cy={69} rx={7} ry={5} fill="#7d5636" transform="rotate(-18 43 69)" />
        </motion.g>
        <motion.g
          animate={{ rotate: listening ? 16 + lively * 10 : 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 12 }}
          style={{ transformOrigin: "178px 68px" }}
        >
          <ellipse cx={178} cy={68} rx={14} ry={11} fill="#a8774b" transform="rotate(18 178 68)" />
          <ellipse cx={177} cy={69} rx={7} ry={5} fill="#7d5636" transform="rotate(18 177 69)" />
        </motion.g>

        {/* head: wide, flat-crowned, distinctly rectangular */}
        <rect x={32} y={56} width={156} height={114} rx={42} fill="#b98657" />

        {/* the snout: broad and blunt, nearly the full width of the face */}
        <rect x={56} y={108} width={108} height={60} rx={30} fill="#c49a70" />
        <rect x={63} y={114} width={94} height={48} rx={24} fill="#e3c4a1" />

        {/* nostrils, not a button nose */}
        <ellipse cx={95} cy={128} rx={5.5} ry={4} fill="#6b4a33" transform="rotate(-16 95 128)" />
        <ellipse cx={125} cy={128} rx={5.5} ry={4} fill="#6b4a33" transform="rotate(16 125 128)" />

        {/* cheeks */}
        <ellipse cx={51} cy={121} rx={11} ry={7.5} fill="#f2a68c" opacity={0.5} />
        <ellipse cx={169} cy={121} rx={11} ry={7.5} fill="#f2a68c" opacity={0.5} />

        <Eyes mood={mood} blink={blink} />
        <Mouth mood={mood} />

        {/* the onsen yuzu, because of course */}
        <motion.g
          animate={{ rotate: [-6, 6, -6] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "110px 50px" }}
        >
          <circle cx={110} cy={48} r={14} fill="#f5b93f" />
          <circle cx={105.5} cy={43.5} r={4.2} fill="#ffd982" opacity={0.85} />
          <path d="M 110 35 Q 118 27 126 31 Q 118 38 110 36 Z" fill="#4da88a" />
        </motion.g>
      </motion.g>

      {/* mood garnish */}
      <AnimatePresence>
        {mood === "thinking" && (
          <motion.g
            key="think"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.circle
                key={i}
                cx={192 + i * 10}
                cy={42 - i * 9}
                r={3.2 + i}
                fill="#917f73"
                animate={{ opacity: [0.25, 1, 0.25] }}
                transition={{ duration: 1.35, repeat: Infinity, delay: i * 0.22 }}
              />
            ))}
          </motion.g>
        )}

        {mood === "cheering" && (
          <motion.g
            key="cheer"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
          >
            {[
              [20, 52],
              [200, 58],
              [26, 122],
              [196, 128],
            ].map(([x, y], i) => (
              <motion.path
                key={i}
                d="M 0 -9 L 2.6 -2.6 L 9 0 L 2.6 2.6 L 0 9 L -2.6 2.6 L -9 0 L -2.6 -2.6 Z"
                transform={`translate(${x} ${y})`}
                fill="#f5b93f"
                animate={{ scale: [0.55, 1.15, 0.55], rotate: [0, 90, 180] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.17 }}
              />
            ))}
          </motion.g>
        )}

        {mood === "sleepy" && (
          <motion.g
            key="zzz"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.text
                key={i}
                x={188 + i * 11}
                y={46 - i * 15}
                fontSize={13 + i * 5}
                fontWeight={800}
                fill="#917f73"
                animate={{ opacity: [0, 1, 0], y: [46 - i * 15, 36 - i * 15] }}
                transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.45 }}
              >
                z
              </motion.text>
            ))}
          </motion.g>
        )}
      </AnimatePresence>
    </motion.svg>
  );
}
