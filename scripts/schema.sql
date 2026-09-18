-- Applied automatically on first write (see src/lib/db.ts migrate()).
-- Kept here so a branch can be seeded by hand: insta run psql < scripts/schema.sql
create table if not exists learners (
  id          text primary key,
  name        text,
  voice_id    text,
  branch      text,
  created_at  timestamptz not null default now()
);

create table if not exists attempts (
  id          text primary key,
  learner_id  text not null references learners(id) on delete cascade,
  phrase_id   text not null,
  overall     integer not null,
  detail      jsonb not null,
  created_at  timestamptz not null default now()
);

create index if not exists attempts_learner_idx
  on attempts (learner_id, created_at desc);
