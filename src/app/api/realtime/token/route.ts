import { NextResponse } from "next/server";
import { hasBosonKey, mintClientSecret } from "@/lib/boson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!hasBosonKey()) {
    return NextResponse.json(
      { error: "BOSON_API_KEY is not set", demo: true },
      { status: 503 },
    );
  }
  try {
    const secret = await mintClientSecret(600);
    return NextResponse.json(secret);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
