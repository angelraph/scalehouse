-- Tag every off-chain row with its chain so mainnet (5042) and testnet (5042002) share one
-- database without mixing. Existing rows are all testnet. Idempotent.
alter table sh_evidence   add column if not exists chain_id integer not null default 5042002;
alter table sh_rationales add column if not exists chain_id integer not null default 5042002;
alter table sh_events     add column if not exists chain_id integer not null default 5042002;
alter table sh_screenings add column if not exists chain_id integer not null default 5042002;
alter table sh_agent_runs add column if not exists chain_id integer not null default 5042002;
alter table sh_labels     add column if not exists chain_id integer not null default 5042002;

alter table sh_evidence   drop constraint if exists sh_evidence_pkey;   alter table sh_evidence   add primary key (chain_id, evidence_hash);
alter table sh_rationales drop constraint if exists sh_rationales_pkey; alter table sh_rationales add primary key (chain_id, rationale_hash);
alter table sh_events     drop constraint if exists sh_events_pkey;     alter table sh_events     add primary key (chain_id, tx_hash, log_index);
alter table sh_screenings drop constraint if exists sh_screenings_pkey; alter table sh_screenings add primary key (chain_id, house_id, address);
alter table sh_labels     drop constraint if exists sh_labels_pkey;     alter table sh_labels     add primary key (chain_id, house_id, address);

-- New rows must say which chain they belong to.
alter table sh_evidence   alter column chain_id drop default;
alter table sh_rationales alter column chain_id drop default;
alter table sh_events     alter column chain_id drop default;
alter table sh_screenings alter column chain_id drop default;
alter table sh_agent_runs alter column chain_id drop default;
alter table sh_labels     alter column chain_id drop default;

create index if not exists sh_events_chain_ticket on sh_events (chain_id, ticket_id, block_number);
create index if not exists sh_events_chain_house on sh_events (chain_id, house_id, block_number desc);
create index if not exists sh_events_chain_name on sh_events (chain_id, name, block_number desc);
create index if not exists sh_rationales_chain_ticket on sh_rationales (chain_id, ticket_id);
create index if not exists sh_agent_runs_chain_house on sh_agent_runs (chain_id, house_id, started_at desc);
