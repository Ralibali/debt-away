create table public.savings_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  provider text,
  kind text not null check (kind in ('isk','kf','af','sparkonto','pension','buffert')),
  current_value numeric not null default 0,
  target_value numeric,
  interest_rate numeric,
  is_buffer boolean not null default false,
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.savings_accounts to authenticated;
grant all on public.savings_accounts to service_role;
alter table public.savings_accounts enable row level security;
create policy "own savings_accounts" on public.savings_accounts for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.savings_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  account_id uuid not null references public.savings_accounts on delete cascade,
  snapshot_date date not null,
  value numeric not null,
  deposits_since_last numeric not null default 0,
  created_at timestamptz default now(),
  unique (user_id, account_id, snapshot_date)
);

grant select, insert, update, delete on public.savings_snapshots to authenticated;
grant all on public.savings_snapshots to service_role;
alter table public.savings_snapshots enable row level security;
create policy "own savings_snapshots" on public.savings_snapshots for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index savings_snapshots_account_date_idx on public.savings_snapshots (user_id, account_id, snapshot_date desc);