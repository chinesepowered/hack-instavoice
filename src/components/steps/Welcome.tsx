"use client";

import { motion } from "motion/react";
import { useState } from "react";
import Kapi from "@/components/Kapi";
import { useApp } from "@/lib/store";

export default function Welcome() {
  const { setSession, next } = useApp();
  const [busy, setBusy] = useState(false);

  async function begin() {
    setBusy(true);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        learner: { id: string; branch: string | null };
        capabilities: { boson: boolean; db: boolean; insta: boolean };
      };
      setSession({
        learnerId: data.learner.id,
        branch: data.learner.branch,
        caps: data.capabilities,
      });
      next();
    } catch {
      // Never block the demo on a cold backend.
      setSession({
        learnerId: crypto.randomUUID(),
        branch: null,
        caps: { boson: false, db: false, insta: false },
      });
      next();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 pt-10 text-center">
      <div className="drift">
        <Kapi mood="idle" size={230} />
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-2 text-5xl font-black tracking-tight sm:text-6xl"
      >
        Mother Tongue
        <span className="han ml-3 text-persimmon">母语</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-5 max-w-lg text-lg font-semibold leading-relaxed text-mist"
      >
        You&rsquo;ll never sound like a native speaker.
        <br />
        <span className="text-ink">You can sound like yourself.</span>
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-8 w-full max-w-md rounded-[1.75rem] bg-paper/80 p-5 text-left text-[15px] font-semibold leading-relaxed text-mist shadow-soft"
      >
        <p>
          Read one sentence out loud in English. In about ten seconds
          you&rsquo;ll hear <span className="text-ink">your own voice</span>{" "}
          speaking Mandarin &mdash; and then Kapi will teach you to catch up
          with it.
        </p>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        onClick={begin}
        disabled={busy}
        className="btn btn-primary mt-8 px-10 py-4 text-lg"
      >
        {busy ? "Waking Kapi…" : "开始 · Start"}
      </motion.button>

      <p className="mt-4 text-xs font-semibold text-mist">
        Needs a microphone. Nothing leaves your branch.
      </p>
    </div>
  );
}
