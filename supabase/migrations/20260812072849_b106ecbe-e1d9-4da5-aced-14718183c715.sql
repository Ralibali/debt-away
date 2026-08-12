create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  kind text not null check (kind in ('csn','billan','privatlan','kreditkort','kontokredit')),
  has_collateral boolean not null default false,
  is_revolving boolean not null default false,
  original_amount numeric,
  current_balance numeric not null,
  credit_limit numeric,
  nominal_rate numeric not null,
  min_payment numeric,
  min_payment_pct numeric,
  monthly_fee numeric default 0,
  payment_day int check (payment_day between 1 and 28),
  interest_daily boolean not null default false,
  notes text,
  created_at timestamptz default now()
);

create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  loan_id uuid not null references public.loans on delete cascade,
  paid_at date not null,
  amount numeric not null,
  interest_part numeric,
  principal_part numeric,
  is_extra boolean not null default false,
  created_at timestamptz default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  kind text not null check (kind in ('lonekonto','sparkonto','kontant','ovrigt')),
  balance numeric not null default 0,
  created_at timestamptz default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  kind text not null check (kind in ('inkomst','utgift')),
  is_fixed boolean not null default false,
  created_at timestamptz default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  account_id uuid references public.accounts on delete set null,
  category_id uuid references public.categories on delete set null,
  occurred_at date not null,
  amount numeric not null,
  description text,
  is_recurring boolean not null default false,
  created_at timestamptz default now()
);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  category_id uuid not null references public.categories on delete cascade,
  month date not null,
  planned numeric not null,
  created_at timestamptz default now(),
  unique (user_id, category_id, month)
);

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  extra_per_month numeric not null default 0,
  strategy text not null check (strategy in ('avalanche','snowball')),
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.loans to authenticated;
grant all on public.loans to service_role;
grant select, insert, update, delete on public.loan_payments to authenticated;
grant all on public.loan_payments to service_role;
grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;
grant select, insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
grant select, insert, update, delete on public.transactions to authenticated;
grant all on public.transactions to service_role;
grant select, insert, update, delete on public.budgets to authenticated;
grant all on public.budgets to service_role;
grant select, insert, update, delete on public.scenarios to authenticated;
grant all on public.scenarios to service_role;

alter table public.loans enable row level security;
alter table public.loan_payments enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.scenarios enable row level security;

create policy "own loans" on public.loans for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own loan_payments" on public.loan_payments for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own accounts" on public.accounts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own categories" on public.categories for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions" on public.transactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own budgets" on public.budgets for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own scenarios" on public.scenarios for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index loans_user_idx on public.loans(user_id);
create index loan_payments_user_idx on public.loan_payments(user_id, loan_id);
create index transactions_user_idx on public.transactions(user_id, occurred_at);
create index budgets_user_idx on public.budgets(user_id, month);