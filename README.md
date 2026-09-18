# Mother Tongue 母语

**You'll never sound like a native speaker. You can sound like yourself.**

Clone your own voice in fifteen seconds, then hear *yourself* speaking Mandarin —
and learn to catch up with it. Built for heritage speakers: people who are
ethnically Chinese, understand more than they can say, and have apologised in
English for their Chinese more times than they can count.

Kapi 卡皮, a capybara, is extremely relaxed about your Mandarin.

**Live:** https://prod-main-app-72ab6b-20xs7r50raw.compute.instacloud-edge.com
(InstaCloud compute, `ap-southeast` / Singapore)

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

1. Synthesise the target in the learner's cloned voice.
2. Take an RMS **energy envelope** of both the target and the attempt.
3. Align them with **DTW**, and walk the warping path back so every target
   syllable knows where it landed in the learner's timeline.
4. Score = words landed (45%) + rhythm (35%) + pace (20%).

The visual is the whole point: target on top, your attempt mirrored underneath,
drifted characters highlighted. `src/lib/score.ts`.

## What the live API actually does (vs. the docs)

Everything below was verified against the real endpoints, not read off a page.

- **`timestamps` always returns `null`.** The docs advertise word-level
  timestamps for English, Chinese and Spanish. The field is accepted and the
  response envelope changes shape, but the value is `null` — for every language,
  every length, and for the docs' own `"The quick brown fox…"` example.
  So `deriveStamps()` recovers per-character windows from the audio instead:
  Mandarin is syllable-timed and one hanzi is one syllable, so N characters means
  N energy bursts, and we cut the voiced span at the N-1 deepest well-separated
  valleys. Verified: 11 characters → 11 syllables, 0.24s mean. Arguably better
  than the API feature, since it measures the audio that actually got generated.
- **Voice cloning returns `voice_id`**, not `voice` or `id` as the docs samples
  show. Reading the documented field yields "no voice id" on every clone.
- **There is no standalone STT endpoint.** `higgs-stt-3.1` exists *only* inside a
  Realtime session, so scoring opens a short manual-turn WebSocket
  (`turn_detection: null`, `output_modalities: ["text"]`), pushes the recording,
  and reads `conversation.item.input_audio_transcription.completed`.
  Transcription quality is excellent — exact, character-for-character on a 2.8s
  Mandarin clip — but it needs ~2s of audio; sub-second clips come back as
  nonsense in the wrong language.
- **The browser talks to Boson directly** — no WebSocket proxy. The server mints
  an ephemeral key (`POST /v1/realtime/client_secrets`) and the browser passes it
  as a subprotocol: `["realtime", "bai-client-secret.<key>"]`.
- **Rate limits are tight enough to hit by hand**, and a 429 mid-demo looks
  exactly like a broken app, so every call retries with backoff.
- TTS degrades past ~300 characters and returns garbled audio as a *200*, not an
  error. `chunkForTts()` splits on CJK sentence boundaries.
- Reference audio for cloning must be **≥ 3 seconds**; the UI asks for 15.
- Avatar renders a 480x640 clip in about **10 seconds**.

> If you send Chinese through `curl -d` from Git Bash on Windows it arrives as
> mojibake and the model generates ~¼-length garbage audio at a 200. Send the
> body as a UTF-8 file (`--data-binary @body.json`). This cost an hour.

## How InstaCloud is used

The standout primitive is **branching** — a branch clones the Postgres data, the
bucket, and every compute service in about a second. So:

**Every learner gets their own branch, forked at runtime** (~1.2s, measured). Your
cloned voiceprint never shares a table with anyone else's, and cleanup is one
`insta branch delete`. That makes branching a privacy property, not a metaphor.
The infra panel (top-right in the app) shows the live branch list.

`src/lib/insta.ts` · `src/app/api/session/route.ts`

CLI notes (verified against `insta` 0.1.0, which differs from the docs):

- The regions command is **`insta config regions`**, not `insta regions`.
  Singapore is **`ap-southeast`**.
- There is **no `insta manifest`** command — the infra panel composes its view
  from `status --json` + `services list --json` + `branch list --json`.
- `insta branch delete <name>` takes no confirmation flag.
- On Windows the global CLI is a `.CMD` shim that Node's `execFile` cannot
  resolve, so spawning fails with `ENOENT` even though it works in a terminal.
  Set `INSTA_BIN` to the shim's full path, or rely on the `shell: true` fallback.

Region is fixed at service-creation time and there is no multi-region, so
`scripts/insta-setup.sh` sets it before anything else.

## Keeping the tooling contained

`insta project create` / `project link` have side effects well outside what the
command name suggests, with no opt-out flag. On a first run they:

- install **24 vendor `SKILL.md` files** into `.claude/skills/`, `.agents/skills/`
  and `.github/skills/` (insta, tigris, better-auth). These load straight into a
  coding agent's context in this repo.
- install a **`PostToolUse` hook** into `.claude/settings.json` and
  `.codex/hooks.json` that executes `.insta/observe/hook.js` after *every* agent
  tool call.
- write the **account access token** to `~/.insta/config.json`, outside the repo.
- append their own entries to `.gitignore`.

For the record, the observe hook was audited and is **local-only**: it scans
tool-use events for credential exposure and appends findings to
`.insta/audit.jsonl`. There is no `fetch`, no HTTP client and no URL anywhere in
it, so nothing is transmitted. (`insta agent observe report` reads that file
separately — don't run it if the log may contain anything sensitive.)

None of it is wanted here, so:

- `.gitignore` excludes `.insta/`, `.claude/`, `.codex/`, `.agents/`,
  `.github/skills/` and `skills-lock.json` wholesale, so re-injected files can
  never reach a commit or be picked up as skills.
- `scripts/insta-setup.sh` runs the CLI through **`pnpm dlx`** (never installed
  globally), redirects `HOME` to a repo-local `.insta-home/` so the token stays
  inside the repo, and **scrubs** the injected files after every call.
- Revoke the machine's session with `rm -rf .insta-home`.

If you ever run the CLI by hand, do it the same way:

```bash
HOME=$PWD/.insta-home USERPROFILE=$PWD/.insta-home pnpm dlx insta@latest <cmd>
```

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

Next.js 16 · React 19 · Tailwind 4 · TypeScript 5.9 · motion · postgres · zustand

TypeScript is pinned to 5.9 and ESLint to 9.x on purpose: `typescript-eslint`
does not support TS 7, and `eslint-plugin-react` breaks on ESLint 10. Everything
else is current.

## Layout

```
src/lib/boson.ts      Boson client: voices, speech, client secrets, avatar
src/lib/realtime.ts   Browser WebSocket: conversation + transcribe-once
src/lib/score.ts      Energy envelopes, DTW alignment, syllable derivation
src/lib/audio.ts      Capture, WAV encoding, PCM16, gapless playback
src/lib/insta.ts      Branch-per-learner over the insta CLI
src/lib/content.ts    The Mandarin. Read this one first.
src/components/Kapi.tsx  The capybara
```

## Consent

Voice cloning requires the right to the voice. The app only ever clones the
person sitting in front of it, from a script they read aloud themselves.
