import { NextResponse } from "next/server";
import { createLearner, hasDb } from "@/lib/db";
import { createLearnerBranch, instaConfigured } from "@/lib/insta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const id = crypto.randomUUID();

  // Every learner gets their own InstaCloud branch — a full copy-on-write fork
  // of the database and bucket, so one person's voiceprint never shares a table
  // with anyone else's, and cleanup is a single branch delete.
  const branch = await createLearnerBranch(id);
  const learner = await createLearner(id, body.name ?? null, branch);

  return NextResponse.json({
    learner,
    capabilities: {
      boson: Boolean(process.env.BOSON_API_KEY),
      db: hasDb,
      insta: instaConfigured(),
    },
  });
}
