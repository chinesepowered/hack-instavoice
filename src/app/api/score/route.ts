import { NextResponse } from "next/server";
import { recordAttempt } from "@/lib/db";
import { scorePractice } from "@/lib/score";
import type { WordStamp } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    learnerId?: string;
    phraseId?: string;
    target?: string;
    heard?: string;
    targetEnvelope?: number[];
    userEnvelope?: number[];
    targetDuration?: number;
    userDuration?: number;
    stamps?: WordStamp[] | null;
  };

  if (!body.target || !body.targetEnvelope || !body.userEnvelope) {
    return NextResponse.json({ error: "missing scoring inputs" }, { status: 400 });
  }

  const score = scorePractice({
    target: body.target,
    heard: body.heard ?? "",
    targetEnvelope: body.targetEnvelope,
    userEnvelope: body.userEnvelope,
    targetDuration: body.targetDuration ?? 0,
    userDuration: body.userDuration ?? 0,
    stamps: body.stamps ?? null,
  });

  if (body.learnerId && body.phraseId) {
    await recordAttempt(body.learnerId, body.phraseId, score).catch((err) =>
      console.error("[score] persist failed:", (err as Error).message),
    );
  }

  return NextResponse.json(score);
}
