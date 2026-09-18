"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Kapi from "@/components/Kapi";
import { Speech } from "@/components/ui";
import { useApp } from "@/lib/store";

const SUGGESTIONS = [
  { hanzi: "奶奶，我想你了。我在学中文。", english: "Grandma, I miss you. I'm learning Chinese." },
  { hanzi: "妈，我吃饭了。你呢？", english: "Mum, I've eaten. Have you?" },
  { hanzi: "我爱你们。谢谢你们。", english: "I love you. Thank you." },
];

/** Avatar rendering is slow, so it lives here at the end where latency is free. */
export default function Finale() {
  const { voiceId, go } = useApp();
  const [image, setImage] = useState<string | null>(null);
  const [text, setText] = useState(SUGGESTIONS[0].hanzi);
  const [state, setState] = useState<"idle" | "rendering" | "done" | "error">("idle");
  const [video, setVideo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (poll.current) clearTimeout(poll.current);
      if (video) URL.revokeObjectURL(video);
    },
    [video],
  );

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function render() {
    if (!image) return;
    setState("rendering");
    setError(null);
    try {
      const res = await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, text, voice: voiceId }),
      });
      const job = (await res.json()) as { id?: string; error?: string; demo?: boolean };
      if (!job.id) throw new Error(job.error ?? "Could not start the render");
      if (job.demo) {
        setError("Avatar video needs a Boson API key. Everything else still works.");
        setState("error");
        return;
      }
      await waitFor(job.id);
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  }

  async function waitFor(id: string, tries = 0): Promise<void> {
    if (tries > 150) throw new Error("Render timed out");
    const res = await fetch(`/api/avatar?id=${id}`);
    const type = res.headers.get("Content-Type") ?? "";
    if (type.startsWith("video/")) {
      const blob = await res.blob();
      setVideo(URL.createObjectURL(blob));
      setState("done");
      return;
    }
    const job = (await res.json()) as { status?: string; error?: string };
    if (job.status === "failed") throw new Error("The render failed");
    await new Promise<void>((r) => {
      poll.current = setTimeout(r, 2000);
    });
    return waitFor(id, tries + 1);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 pt-6 pb-16">
      <div className="flex items-start gap-4">
        <Kapi mood={state === "done" ? "cheering" : state === "rendering" ? "thinking" : "idle"} size={120} />
        <div className="pt-5">
          <AnimatePresence mode="wait">
            <Speech key={state}>
              {state === "idle" && "One last thing. Send it to someone who'll understand."}
              {state === "rendering" && "Making your face say it… about a minute."}
              {state === "done" && "There you are. Go send it."}
              {state === "error" && "Couldn't finish that one — but you still said it."}
            </Speech>
          </AnimatePresence>
        </div>
      </div>

      <div className="card mt-7">
        <label className="block text-sm font-black tracking-wide text-mist">
          1 · A photo of you
        </label>
        <div className="mt-3 flex items-center gap-4">
          <label className="btn btn-ghost cursor-pointer">
            {image ? "Change photo" : "Choose a photo"}
            <input type="file" accept="image/*" onChange={pickPhoto} className="hidden" />
          </label>
          {image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={image}
              alt="Your reference"
              className="h-16 w-16 rounded-2xl object-cover shadow-soft"
            />
          )}
        </div>

        <label className="mt-7 block text-sm font-black tracking-wide text-mist">
          2 · What you want to say
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          rows={3}
          className="han mt-3 w-full resize-none rounded-2xl bg-cream-deep/60 px-4 py-3 text-xl font-medium outline-none focus:ring-2 focus:ring-persimmon"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.hanzi}
              onClick={() => setText(s.hanzi)}
              title={s.english}
              className="han rounded-xl bg-paper px-3 py-1.5 text-sm font-bold text-mist hover:text-ink"
            >
              {s.hanzi}
            </button>
          ))}
        </div>

        <button
          onClick={render}
          disabled={!image || state === "rendering"}
          className="btn btn-primary mt-7 w-full py-4 text-lg"
        >
          {state === "rendering" ? "Rendering…" : "🎬  Make the video"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl bg-persimmon-soft px-4 py-3 text-sm font-bold text-persimmon">
          {error}
        </p>
      )}

      <AnimatePresence>
        {video && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card mt-5 flex flex-col items-center"
          >
            <video src={video} controls autoPlay className="w-full max-w-xs rounded-[1.5rem]" />
            <a href={video} download="mother-tongue.mp4" className="btn btn-jade mt-5">
              ↓ Save it
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-10 text-center">
        <p className="text-sm font-semibold text-mist">
          你在学。慢慢来。
          <span className="mt-1 block">You&rsquo;re learning. Take your time.</span>
        </p>
        <button onClick={() => go("practice")} className="btn btn-ghost mt-5">
          ← Back to practice
        </button>
      </div>
    </div>
  );
}
