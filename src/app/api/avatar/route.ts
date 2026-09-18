import { NextResponse } from "next/server";
import { createVideo, getVideo, hasBosonKey, videoContent } from "@/lib/boson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { image, text, voice } = (await req.json()) as {
    image?: string;
    text?: string;
    voice?: string;
  };
  if (!image || !text) {
    return NextResponse.json({ error: "image and text are required" }, { status: 400 });
  }
  if (!hasBosonKey()) {
    return NextResponse.json({ id: "demo-video", status: "completed", demo: true });
  }
  try {
    const job = await createVideo({
      refImage: image.startsWith("data:") ? image : `data:image/png;base64,${image}`,
      ttsInput: text,
      voice: voice && voice !== "demo-voice" ? voice : "default",
      size: "480x640",
    });
    return NextResponse.json(job);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  if (!hasBosonKey()) {
    return NextResponse.json({ id, status: "completed", demo: true });
  }
  try {
    const job = await getVideo(id);
    if (job.status !== "completed") return NextResponse.json(job);
    const bytes = await videoContent(id);
    return new NextResponse(bytes as ArrayBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `inline; filename="mother-tongue-${id}.mp4"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
