import { NextResponse } from "next/server";
import { hasBosonKey, speech } from "@/lib/boson";
import { mockStamps, mockWav } from "@/lib/mock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { input, voice, tags, timestamps } = (await req.json()) as {
    input?: string;
    voice?: string;
    tags?: string;
    timestamps?: boolean;
  };
  if (!input) {
    return NextResponse.json({ error: "input is required" }, { status: 400 });
  }

  if (!hasBosonKey()) {
    const seconds = Math.max(1.4, [...input].length * 0.28);
    return NextResponse.json({
      audio: mockWav(seconds),
      format: "wav",
      timestamps: timestamps ? mockStamps(input, seconds) : null,
      demo: true,
    });
  }

  try {
    const result = await speech({
      input: `${tags ?? ""}${input}`,
      voice: voice && voice !== "demo-voice" ? voice : "default",
      timestamps,
      format: "wav",
      tnLanguage: "zh",
    });
    return NextResponse.json({ ...result, demo: false });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
