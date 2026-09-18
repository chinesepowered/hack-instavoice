"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";

type Infra = {
  configured: boolean;
  project?: string;
  branch?: string;
  region?: string | null;
  services: { type: string; name: string; url?: string }[];
  branches: { name: string; createdAt?: string }[];
  db?: boolean;
  boson?: boolean;
  error?: string;
};

/**
 * Deliberately visible. The InstaCloud story is that every learner gets their
 * own branch — a copy-on-write fork of the Postgres data and the bucket — so
 * one person's cloned voiceprint is never in the same table as anyone else's.
 */
export default function InfraPanel() {
  const { branch, caps } = useApp();
  const [open, setOpen] = useState(false);
  const [infra, setInfra] = useState<Infra | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/infra")
      .then((r) => r.json())
      .then(setInfra)
      .catch(() => setInfra(null));
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="pill bg-paper text-mist shadow-soft transition-colors hover:text-ink"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            caps.insta ? "bg-jade" : "bg-cream-deep"
          }`}
        />
        {branch ?? "local"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="absolute right-0 top-12 z-20 w-80 rounded-[1.5rem] bg-paper p-5 text-left shadow-lift"
          >
            <p className="text-sm font-black">InstaCloud</p>
            <p className="mt-1 text-xs font-semibold leading-snug text-mist">
              One branch per learner. Each fork clones the database, the bucket,
              and every service in about a second.
            </p>

            <dl className="mt-4 space-y-2 text-xs font-bold">
              <Row label="project" value={infra?.project ?? "—"} />
              <Row label="your branch" value={branch ?? "local (no fork)"} />
              <Row label="region" value={infra?.region ?? "—"} />
              <Row
                label="postgres"
                value={infra?.db ? "connected" : "in-memory"}
                ok={infra?.db}
              />
              <Row
                label="boson"
                value={caps.boson ? "live" : "demo mode"}
                ok={caps.boson}
              />
            </dl>

            {infra?.services && infra.services.length > 0 && (
              <>
                <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-mist">
                  services
                </p>
                <ul className="mt-1.5 space-y-1">
                  {infra.services.map((s) => (
                    <li key={`${s.type}/${s.name}`} className="text-xs font-bold">
                      <span className="text-persimmon">{s.type}</span>
                      <span className="text-mist"> / {s.name}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {infra?.branches && infra.branches.length > 0 && (
              <>
                <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-mist">
                  live branches · {infra.branches.length}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {infra.branches.slice(0, 12).map((b) => (
                    <span
                      key={b.name}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-bold ${
                        b.name === branch
                          ? "bg-persimmon text-white"
                          : "bg-cream-deep text-mist"
                      }`}
                    >
                      {b.name}
                    </span>
                  ))}
                </div>
              </>
            )}

            {infra?.error && (
              <p className="mt-3 text-[11px] font-bold text-persimmon">
                {infra.error}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-mist">{label}</dt>
      <dd
        className={`truncate text-right ${
          ok === undefined ? "text-ink" : ok ? "text-jade" : "text-mist"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
