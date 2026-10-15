-- Scalehouse off-chain store (Neon Postgres). The chain is the source of truth for money and
-- ticket state; this holds only what the chain points at by hash (evidence and agent
-- reasoning) plus an event index so pages don't rescan the chain on every view.
-- Idempotent: safe to run more than once.

create table if not exists sh_evidence (
  evidence_hash text primary key,          -- keccak256(payee, normalized reference), as on-chain
  house_id      integer not null,
  payee         text not null,
  reference     text not null,             -- invoice / delivery note / job reference
  note          text not null default '',
  photo         bytea,                     -- evidence photo, served at /api/evidence/photo/<hash>
  photo_type    text,
  photo_sha256  text,
  created_by    text not null,
  created_at    timestamptz not null default now()
);

create table if not exists sh_rationales (
  rationale_hash text primary key,         -- keccak256 of the canonical JSON in `rationale`
  house_id       integer not null,
  ticket_id      integer,
  kind           text not null,            -- RELEASE | DEFER | FLAG | CAP
  model          text not null,
  rationale      text not null,            -- canonical JSON, stored verbatim so the hash re-checks
  tx_hash        text,
  created_at     timestamptz not null default now()
);
create index if not exists sh_rationales_ticket on sh_rationales (ticket_id);
create index if not exists sh_rationales_house on sh_rationales (house_id, created_at desc);

create table if not exists sh_events (
  tx_hash      text not null,
  log_index    integer not null,
  block_number bigint not null,
  block_time   timestamptz,
  name         text not null,
  house_id     integer,
  ticket_id    integer,
  args         jsonb not null,
  primary key (tx_hash, log_index)
);
create index if not exists sh_events_ticket on sh_events (ticket_id, block_number);
create index if not exists sh_events_house on sh_events (house_id, block_number desc);
create index if not exists sh_events_name on sh_events (name, block_number desc);

create table if not exists sh_sync (
  id         text primary key,
  last_block bigint not null,
  updated_at timestamptz not null default now()
);

create table if not exists sh_screenings (
  house_id    integer not null,
  address     text not null,
  result      jsonb not null,
  risk        text not null,               -- clear | elevated | blocked | unavailable
  screened_at timestamptz not null default now(),
  primary key (house_id, address)
);

create table if not exists sh_agent_runs (
  id          bigint generated always as identity primary key,
  house_id    integer not null,
  trigger     text not null,
  model       text,
  summary     text,
  transcript  jsonb,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists sh_agent_runs_house on sh_agent_runs (house_id, started_at desc);

-- Names a house owner gives wallets ("Chidi, rice supplier"). Display only.
create table if not exists sh_labels (
  house_id integer not null,
  address  text not null,
  label    text not null,
  primary key (house_id, address)
);
