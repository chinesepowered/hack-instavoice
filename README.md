# Mother Tongue 母语

**You'll never sound like a native speaker. You can sound like yourself.**

Clone your own voice in fifteen seconds, then hear *yourself* speaking Mandarin —
and learn to catch up with it. Built for heritage speakers: people who are
ethnically Chinese, understand more than they can say, and have apologised in
English for their Chinese more times than they can count.

Kapi 卡皮, a capybara, is extremely relaxed about your Mandarin.

---

## Why your own voice

Every language app models a native speaker you will never sound like. This one
models **you**, speaking correctly. Self-modelling is a real technique — a target
you perceive as attainable is one you actually move toward — and it is only
buildable now that zero-shot voice cloning and 102 languages live in one model.

## The five minutes

| Step | What happens |
|---|---|
| **1 · Clone** | Read one English sentence. `POST /v1/audio/voices` → a reusable `voice_<id>`. |
| **2 · The Mirror** | That voice says 我在学我家的语言。这是我的声音。 This is the moment. |
| **3 · Practice** | Hear the phrase in your own voice, say it back, get scored on **rhythm**. |
| **4 · Scenarios** | Live Mandarin conversation: ordering coffee, a first date (撩), meeting her parents. |
| **5 · Finale** | A photo + a sentence → a talking-head video of you saying it. |

## How the scoring works

Boson has **no pronunciation-scoring endpoint**, so this does not pretend to
score phonemes. It scores the thing that actually makes a heritage speaker sound
foreign: **rhythm and stress**.

1. Synthesise the target in the learner's cloned voice with `timestamps: true` →
   word-level start/end times.
2. Take an RMS **energy envelope** of both the target and the attempt.
3. Align them with **DTW**, and walk the warping path back so every target word
   knows where it landed in the learner's timeline.
4. Score = words landed (45%) + rhythm (35%) + pace (20%).

The visual is the whole point: target on top, your attempt mirrored underneath,
drifted words highlighted. `src/lib/score.ts`.

> Word timestamps are English/Chinese/Spanish only — which is exactly why this
> demo is Mandarin.

## Boson API notes discovered while building

- **There is no standalone STT endpoint.** `higgs-stt-3.1` exists *only* inside a
  Realtime session, so scoring opens a short manual-turn WebSocket
  (`turn_detection: null`, `output_modalities: ["text"]`), pushes the recording,
  and reads `conversation.item.input_audio_transcription.completed`.
  See `transcribeOnce()` in `src/lib/realtime.ts`.
- **The browser talks to Boson directly** — no WebSocket proxy. The server mints
  an ephemeral key (`POST /v1/realtime/client_secrets`) and the browser passes it
  as a subprotocol: `["realtime", "bai-client-secret.<key>"]`.
- **Realtime is multilingual.** It detects the spoken language and replies in
  kind, so the scenarios work in Mandarin without extra configuration.
- **TTS degrades past ~300 characters** and returns garbled audio as a *200*, not
  an error. `chunkForTts()` splits on CJK sentence boundaries.
- `timestamps: true` changes the response from audio bytes to a JSON envelope,
  and cannot be combined with `stream`.
- Reference audio for cloning must be **≥ 3 seconds**; the UI asks for 15.

## How InstaCloud is used

The standout primitive is **branching** — a branch clones the Postgres data, the
bucket, and every compute service in about a second. So:

**Every learner gets their own branch, forked at runtime.** Your cloned
voiceprint never shares a table with anyone else's, and cleanup is one
`insta branch delete`. That makes branching a privacy property, not a metaphor.
The infra panel (top-right in the app) shows the live branch list.

`src/lib/insta.ts` · `src/app/api/session/route.ts`

Region is **Singapore**, set at service-creation time — there is no multi-region
and it cannot be changed later, so `scripts/insta-setup.sh` does it first.

## Run it

```bash
pnpm install
cp .env.example .env    # optional — it runs without keys
pnpm dev
```

**With no keys it still runs end to end** on synthesised tones, so the whole flow
is clickable. Add `BOSON_API_KEY` and it becomes real.

```bash
pnpm build && pnpm start    # production (standalone server)
```

## Deploy

```bash
export BOSON_API_KEY=bai-...
export INSTA_API_KEY=insta_...
./scripts/insta-setup.sh
```

Provisions Postgres + a public bucket + compute in Singapore, binds
`DATABASE_URL`, stores the secrets, and deploys with `--websocket`.

## Stack

Next.js 16 · React 19 · Tailwind 4 · TypeScript 7 · motion · postgres · zustand

## Layout

```
src/lib/boson.ts      Boson client: voices, speech, client secrets, avatar
src/lib/realtime.ts   Browser WebSocket: conversation + transcribe-once
src/lib/score.ts      Energy envelopes, DTW alignment, scoring
src/lib/audio.ts      Capture, WAV encoding, PCM16, gapless playback
src/lib/insta.ts      Branch-per-learner over the insta CLI
src/lib/content.ts    The Mandarin. Read this one first.
src/components/Kapi.tsx  The capybara
```

## Consent

Voice cloning requires the right to the voice. The app only ever clones the
person sitting in front of it, from a script they read aloud themselves.
