"use client";

import { AnimatePresence, motion } from "motion/react";
import InfraPanel from "@/components/InfraPanel";
import { StepDots } from "@/components/ui";
import CloneVoice from "@/components/steps/CloneVoice";
import Finale from "@/components/steps/Finale";
import Mirror from "@/components/steps/Mirror";
import Practice from "@/components/steps/Practice";
import Scenario from "@/components/steps/Scenario";
import Welcome from "@/components/steps/Welcome";
import { STEPS, useApp } from "@/lib/store";

const SCREENS = {
  welcome: Welcome,
  clone: CloneVoice,
  mirror: Mirror,
  practice: Practice,
  scenario: Scenario,
  finale: Finale,
} as const;

export default function Home() {
  const { step, learnerId } = useApp();
  const Screen = SCREENS[step];
  const index = STEPS.indexOf(step);

  return (
    <main className="min-h-dvh">
      {step !== "welcome" && (
        <header className="relative mx-auto flex max-w-3xl items-center justify-between px-6 pt-6">
          <p className="text-lg font-black">
            Mother Tongue
            <span className="han ml-2 text-persimmon">母语</span>
          </p>
          <div className="flex items-center gap-4">
            <StepDots step={index} total={STEPS.length} />
            {learnerId && <InfraPanel />}
          </div>
        </header>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
          <Screen />
        </motion.div>
      </AnimatePresence>
    </main>
  );
}
