"use client";

import { PcmPlayer, base64ToBytes, pcm16ToFloat, pcm16Base64, RATE } from "./audio";

const WS_URL = "wss://api.boson.ai/v1/realtime?model=higgs-realtime";

export type Turn = {
  id: string;
  who: "you" | "them";
  text: string;
  final: boolean;
};

export type RealtimeHandlers = {
  onTurn?: (turn: Turn) => void;
  onStruggle?: (hint: string) => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onOpen?: () => void;
  onError?: (message: string) => void;
  onClose?: () => void;
};

type ServerEvent = {
  type: string;
  delta?: string;
  transcript?: string;
  text?: string;
  item_id?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  error?: { message?: string };
  response?: { output?: Array<{ type?: string; call_id?: string; name?: string; arguments?: string }> };
};

/** Fired by the model when the learner stalls, so Kapi can step in. */
const STRUGGLE_TOOL = {
  type: "function" as const,
  name: "learner_is_struggling",
  description:
    "Call this the moment the learner stalls, goes quiet, repeats themselves, or answers in English. Then rescue them in character.",
  parameters: {
    type: "object",
    properties: {
      hint: {
        type: "string",
        description:
          "One short, warm English hint telling the learner what to try saying next.",
      },
    },
    required: ["hint"],
  },
};

export class RealtimeSession {
  private ws: WebSocket | null = null;
  readonly player = new PcmPlayer();
  private handlers: RealtimeHandlers;
  private assistantText = new Map<string, string>();
  private speaking = false;

  constructor(handlers: RealtimeHandlers = {}) {
    this.handlers = handlers;
  }

  async connect(opts: {
    instructions: string;
    voice: string;
    opener?: string;
    language?: string;
  }) {
    const res = await fetch("/api/realtime/token", { method: "POST" });
    if (!res.ok) throw new Error("Could not mint a Realtime key");
    const { value } = (await res.json()) as { value: string };

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(WS_URL, [
        "realtime",
        `bai-client-secret.${value}`,
      ]);
      this.ws = ws;
      ws.onopen = () => {
        this.send({
          type: "session.update",
          session: {
            model: "higgs-realtime",
            instructions: opts.instructions,
            output_modalities: ["audio"],
            audio: {
              input: {
                format: { type: "audio/pcm", rate: RATE },
                turn_detection: { type: "semantic_vad" },
                noise_reduction: { type: "near_field" },
                transcription: {
                  model: "higgs-stt-3.1",
                  language: opts.language ?? "zh",
                },
              },
              output: { format: { type: "audio/pcm", rate: RATE }, voice: opts.voice },
            },
            tools: [STRUGGLE_TOOL],
            tool_choice: "auto",
          },
        });
        if (opts.opener) {
          this.send({
            type: "response.create",
            response: {
              instructions: `Open the conversation by saying exactly: ${opts.opener}`,
            },
          });
        }
        this.handlers.onOpen?.();
        resolve();
      };
      ws.onerror = () => {
        reject(new Error("Realtime connection failed"));
        this.handlers.onError?.("Realtime connection failed");
      };
      ws.onclose = () => {
        this.setSpeaking(false);
        this.handlers.onClose?.();
      };
      ws.onmessage = (e) => this.handle(JSON.parse(e.data as string) as ServerEvent);
    });
  }

  private setSpeaking(v: boolean) {
    if (this.speaking === v) return;
    this.speaking = v;
    this.handlers.onSpeakingChange?.(v);
  }

  private send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private handle(ev: ServerEvent) {
    switch (ev.type) {
      case "input_audio_buffer.speech_started":
        // Barge-in: the learner started talking, so stop talking over them.
        this.player.interrupt();
        this.setSpeaking(false);
        break;

      case "conversation.item.input_audio_transcription.completed":
        if (ev.transcript) {
          this.handlers.onTurn?.({
            id: ev.item_id ?? crypto.randomUUID(),
            who: "you",
            text: ev.transcript,
            final: true,
          });
        }
        break;

      case "response.output_audio.delta":
        if (ev.delta) {
          this.player.push(pcm16ToFloat(base64ToBytes(ev.delta)));
          this.setSpeaking(true);
        }
        break;

      case "response.output_audio.done":
        this.setSpeaking(false);
        break;

      case "response.output_audio_transcript.delta": {
        const id = ev.item_id ?? "live";
        const next = (this.assistantText.get(id) ?? "") + (ev.delta ?? "");
        this.assistantText.set(id, next);
        this.handlers.onTurn?.({ id, who: "them", text: next, final: false });
        break;
      }

      case "response.output_audio_transcript.done": {
        const id = ev.item_id ?? "live";
        const text = ev.transcript ?? this.assistantText.get(id) ?? "";
        this.assistantText.delete(id);
        this.handlers.onTurn?.({ id, who: "them", text, final: true });
        break;
      }

      case "response.function_call_arguments.done":
        this.onToolCall(ev.call_id, ev.name, ev.arguments);
        break;

      case "response.done": {
        // Some deployments only surface tool calls in the final response object.
        for (const item of ev.response?.output ?? []) {
          if (item.type === "function_call") {
            this.onToolCall(item.call_id, item.name, item.arguments);
          }
        }
        this.setSpeaking(false);
        break;
      }

      case "error":
        this.handlers.onError?.(ev.error?.message ?? "Realtime error");
        break;
    }
  }

  private onToolCall(callId?: string, name?: string, args?: string) {
    if (name !== "learner_is_struggling" || !callId) return;
    let hint = "Take your time. Try just the first two words.";
    try {
      const parsed = JSON.parse(args ?? "{}") as { hint?: string };
      if (parsed.hint) hint = parsed.hint;
    } catch {
      /* keep the fallback */
    }
    this.handlers.onStruggle?.(hint);
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify({ acknowledged: true }),
      },
    });
    this.send({ type: "response.create" });
  }

  /** Stream mic audio in. Turn detection handles commits for us. */
  pushAudio(samples: Float32Array) {
    this.send({ type: "input_audio_buffer.append", audio: pcm16Base64(samples) });
  }

  close() {
    this.player.close();
    this.ws?.close();
    this.ws = null;
  }
}

/**
 * Boson has no standalone speech-to-text endpoint — `higgs-stt-3.1` only exists
 * inside a Realtime session. So scoring opens a short manual-turn session,
 * pushes the recording, and reads back the transcript.
 */
export async function transcribeOnce(
  samples: Float32Array,
  language = "zh",
  timeoutMs = 15000,
): Promise<string> {
  const res = await fetch("/api/realtime/token", { method: "POST" });
  if (!res.ok) throw new Error("Could not mint a Realtime key");
  const { value } = (await res.json()) as { value: string };

  return new Promise<string>((resolve, reject) => {
    const ws = new WebSocket(WS_URL, ["realtime", `bai-client-secret.${value}`]);
    const done = (fn: () => void) => {
      clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* already closing */
      }
      fn();
    };
    const timer = setTimeout(
      () => done(() => reject(new Error("Transcription timed out"))),
      timeoutMs,
    );

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "session.update",
          session: {
            model: "higgs-realtime",
            output_modalities: ["text"],
            instructions: "Transcribe only. Do not reply.",
            audio: {
              input: {
                format: { type: "audio/pcm", rate: RATE },
                turn_detection: null,
                transcription: { model: "higgs-stt-3.1", language },
              },
            },
          },
        }),
      );
      // Append in ~1s slices so we stay well under any frame size limit.
      const SLICE = RATE;
      for (let i = 0; i < samples.length; i += SLICE) {
        ws.send(
          JSON.stringify({
            type: "input_audio_buffer.append",
            audio: pcm16Base64(samples.subarray(i, i + SLICE)),
          }),
        );
      }
      ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    };

    ws.onmessage = (e) => {
      const ev = JSON.parse(e.data as string) as ServerEvent;
      if (ev.type === "conversation.item.input_audio_transcription.completed") {
        done(() => resolve(ev.transcript ?? ""));
      } else if (ev.type === "error") {
        done(() => reject(new Error(ev.error?.message ?? "Realtime error")));
      }
    };
    ws.onerror = () => done(() => reject(new Error("Realtime connection failed")));
  });
}
