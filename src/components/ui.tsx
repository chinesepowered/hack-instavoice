"use client";

import { motion } from "motion/react";

export function ScoreRing({ value, size = 96 }: { value: number; size?: number }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const tone = value >= 82 ? "#4da88a" : value >= 60 ? "#f5b93f" : "#e8663f";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#f0dcc2"
          strokeWidth={9}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * value) / 100 }}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <motion.span
          className="text-2xl font-black"
          style={{ color: tone }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 15 }}
        >
          {value}
        </motion.span>
      </div>
    </div>
  );
}

export function Meter({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="flex-1">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs font-bold text-mist">{label}</span>
        <span className="text-sm font-black text-ink">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-cream-deep">
        <motion.div
          className="h-full rounded-full bg-capy"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ type: "spring", stiffness: 70, damping: 16 }}
        />
      </div>
      <p className="mt-1 text-[11px] leading-tight text-mist">{hint}</p>
    </div>
  );
}

export function Speech({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className="relative max-w-sm rounded-[1.5rem] bg-paper px-5 py-3.5 text-[15px] font-semibold leading-snug shadow-soft"
    >
      {children}
      <span className="absolute -bottom-2 left-9 h-4 w-4 rotate-45 rounded-sm bg-paper" />
    </motion.div>
  );
}

export function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <motion.span
          key={i}
          className="h-2 rounded-full"
          animate={{
            width: i === step ? 22 : 8,
            backgroundColor: i <= step ? "#e8663f" : "#ecd9c0",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
        />
      ))}
    </div>
  );
}
