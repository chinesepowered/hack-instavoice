import { NextResponse } from "next/server";
import { hasDb } from "@/lib/db";
import { infra } from "@/lib/insta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const state = await infra();
  return NextResponse.json({
    ...state,
    db: hasDb,
    boson: Boolean(process.env.BOSON_API_KEY),
    region: state.region ?? process.env.INSTA_REGION ?? null,
  });
}
