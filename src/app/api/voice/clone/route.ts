import { NextResponse } from "next/server";
import { createVoice, hasBosonKey } from "@/lib/boson";
import { setVoice } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { learnerId, audio, text } = (await req.json()) as {
    learnerId?: string;
    audio?: string;
    text?: string;
  };
  if (!audio || !text) {
    return NextResponse.json({ error: "audio and text are required" }, { status: 400 });
  }

  if (!hasBosonKey()) {
    return NextResponse.json({ voice: "demo-voice", demo: true });
  }

  try {
    const voice = await createVoice(
      `data:audio/wav;base64,${audio}`,
      text,
      "Mother Tongue learner voice",
    );
    if (learnerId) await setVoice(learnerId, voice);
    return NextResponse.json({ voice, demo: false });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
