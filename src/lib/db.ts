import "server-only";
import postgres from "postgres";
import type { PracticeScore } from "./types";

export type Learner = {
  id: string;
  name: string | null;
  voiceId: string | null;
  branch: string | null;
  createdAt: string;
};

export type Attempt = {
  id: string;
  learnerId: string;
  phraseId: string;
  overall: number;
  detail: PracticeScore;
  createdAt: string;
};

const url = process.env.DATABASE_URL;
export const hasDb = Boolean(url);

const sql = url
  ? postgres(url, { max: 4, idle_timeout: 20, prepare: false })
  : null;

/** The demo still runs with no Postgres attached; it just forgets everything. */
const memLearners = new Map<string, Learner>();
const memAttempts: Attempt[] = [];

let ready: Promise<void> | null = null;
export function migrate() {
  if (!sql) return Promise.resolve();
  ready ??= (async () => {
    await sql`
      create table if not exists learners (
        id          text primary key,
        name        text,
        voice_id    text,
        branch      text,
        created_at  timestamptz not null default now()
      )`;
    await sql`
      create table if not exists attempts (
        id          text primary key,
        learner_id  text not null references learners(id) on delete cascade,
        phrase_id   text not null,
        overall     integer not null,
        detail      jsonb not null,
        created_at  timestamptz not null default now()
      )`;
    await sql`
      create index if not exists attempts_learner_idx
        on attempts (learner_id, created_at desc)`;
  })();
  return ready;
}

export async function createLearner(
  id: string,
  name: string | null,
  branch: string | null,
): Promise<Learner> {
  const row: Learner = {
    id,
    name,
    voiceId: null,
    branch,
    createdAt: new Date().toISOString(),
  };
  if (!sql) {
    memLearners.set(id, row);
    return row;
  }
  await migrate();
  await sql`
    insert into learners (id, name, branch) values (${id}, ${name}, ${branch})
    on conflict (id) do update set name = excluded.name`;
  return row;
}

export async function setVoice(id: string, voiceId: string) {
  if (!sql) {
    const row = memLearners.get(id);
    if (row) row.voiceId = voiceId;
    return;
  }
  await migrate();
  await sql`update learners set voice_id = ${voiceId} where id = ${id}`;
}

export async function getLearner(id: string): Promise<Learner | null> {
  if (!sql) return memLearners.get(id) ?? null;
  await migrate();
  const [row] = await sql<
    { id: string; name: string | null; voice_id: string | null; branch: string | null; created_at: Date }[]
  >`select * from learners where id = ${id}`;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    voiceId: row.voice_id,
    branch: row.branch,
    createdAt: row.created_at.toISOString(),
  };
}

export async function recordAttempt(
  learnerId: string,
  phraseId: string,
  detail: PracticeScore,
): Promise<void> {
  const row: Attempt = {
    id: crypto.randomUUID(),
    learnerId,
    phraseId,
    overall: detail.overall,
    detail,
    createdAt: new Date().toISOString(),
  };
  if (!sql) {
    memAttempts.unshift(row);
    return;
  }
  await migrate();
  await sql`
    insert into attempts (id, learner_id, phrase_id, overall, detail)
    values (${row.id}, ${learnerId}, ${phraseId}, ${row.overall}, ${sql.json(detail as never)})`;
}

export async function bestScores(
  learnerId: string,
): Promise<Record<string, number>> {
  if (!sql) {
    const out: Record<string, number> = {};
    for (const a of memAttempts.filter((a) => a.learnerId === learnerId)) {
      out[a.phraseId] = Math.max(out[a.phraseId] ?? 0, a.overall);
    }
    return out;
  }
  await migrate();
  const rows = await sql<{ phrase_id: string; best: number }[]>`
    select phrase_id, max(overall)::int as best
    from attempts where learner_id = ${learnerId}
    group by phrase_id`;
  return Object.fromEntries(rows.map((r) => [r.phrase_id, r.best]));
}
