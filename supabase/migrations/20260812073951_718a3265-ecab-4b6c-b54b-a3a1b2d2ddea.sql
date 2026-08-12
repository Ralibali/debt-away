create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  module text not null check (module in ('leaks','budget','friction','purchase','strategy')),
  input_hash text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);

grant select, insert, update, delete on public.ai_insights to authenticated;
grant all on public.ai_insights to service_role;

alter table public.ai_insights enable row level security;

create policy "own ai_insights" on public.ai_insights
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index ai_insights_user_module_idx on public.ai_insights (user_id, module, created_at desc);
create unique index ai_insights_user_module_hash_idx on public.ai_insights (user_id, module, input_hash);

create table public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  item text not null,
  price numeric not null,
  url text,
  added_at timestamptz default now(),
  cooldown_until date not null,
  mood text,
  decision text check (decision in ('köpt','avstått','väntar')) default 'väntar',
  decided_at timestamptz
);

grant select, insert, update, delete on public.wishlist to authenticated;
grant all on public.wishlist to service_role;

alter table public.wishlist enable row level security;

create policy "own wishlist" on public.wishlist
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index wishlist_user_idx on public.wishlist (user_id, added_at desc);

create or replace function public.wishlist_enforce_cooldown()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.decision = 'köpt' and new.cooldown_until > current_date then
    raise exception 'Kylperioden är inte slut ännu (till och med %)', new.cooldown_until;
  end if;
  if tg_op = 'UPDATE' and new.decision is distinct from old.decision and new.decision <> 'väntar' then
    new.decided_at := now();
  end if;
  return new;
end;
$$;

create trigger wishlist_cooldown_guard
before insert or update on public.wishlist
for each row execute function public.wishlist_enforce_cooldown();