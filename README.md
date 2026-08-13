# Debt-Free Path

# Lovable — startprompt: Privatekonomi & låneavbetalning

> Klistra in hela detta block som första prompt i ett nytt Lovable-projekt.

---

Bygg en svensk webbapp för **min egen privatekonomi** — budget, översikt och framför allt en motor som räknar ut hur jag snabbast blir skuldfri. Enanvändarapp, inga delade hushåll.

## Stack

- React + TypeScript + Vite, Tailwind, shadcn/ui

- Supabase för auth (e-post/lösenord) och databas

- RLS på **alla** tabeller: `auth.uid() = user_id`, ingen policy som tillåter läsning utan matchande user_id

- All valuta i SEK, all formatering `sv-SE`, alla datum ISO i databasen

## Datamodell

```sql

-- Lån

create table loans (

  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users on delete cascade,

  name text not null,

  kind text not null check (kind in ('csn','billan','privatlan','kreditkort','kontokredit')),

  has_collateral boolean not null default false,   -- pant, t.ex. bil

  is_revolving boolean not null default false,     -- kort/kontokredit

  original_amount numeric,                         -- null för revolving

  current_balance numeric not null,

  credit_limit numeric,                            -- endast revolving

  nominal_rate numeric not null,                   -- årsränta i procent, t.ex. 12.5

  min_payment numeric,                             -- fast månadsbelopp

  min_payment_pct numeric,                         -- alternativ: % av saldo (revolving)

  monthly_fee numeric default 0,                   -- aviavgift/årsavgift/12

  payment_day int check (payment_day between 1 and 28),

  interest_daily boolean not null default false,   -- true för CSN

  notes text,

  created_at timestamptz default now()

);

-- Betalningar (manuell inmatning)

create table loan_payments (

  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users on delete cascade,

  loan_id uuid not null references loans on delete cascade,

  paid_at date not null,

  amount numeric not null,

  interest_part numeric,       -- valfri, kan lämnas tom

  principal_part numeric,

  is_extra boolean not null default false

);

-- Konton, transaktioner, kategorier, budget

create table accounts (

  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users on delete cascade,

  name text not null,

  kind text not null check (kind in ('lonekonto','sparkonto','kontant','ovrigt')),

  balance numeric not null default 0

);

create table categories (

  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users on delete cascade,

  name text not null,

  kind text not null check (kind in ('inkomst','utgift')),

  is_fixed boolean not null default false   -- fast kostnad vs rörlig

);

create table transactions (

  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users on delete cascade,

  account_id uuid references accounts on delete set null,

  category_id uuid references categories on delete set null,

  occurred_at date not null,

  amount numeric not null,     -- negativ = utgift, positiv = inkomst

  description text,

  is_recurring boolean not null default false

);

create table budgets (

  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users on delete cascade,

  category_id uuid not null references categories on delete cascade,

  month date not null,         -- alltid den 1:a i månaden

  planned numeric not null,

  unique (user_id, category_id, month)

);

-- Sparade avbetalningsscenarier

create table scenarios (

  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users on delete cascade,

  name text not null,

  extra_per_month numeric not null default 0,

  strategy text not null check (strategy in ('avalanche','snowball')),

  created_at timestamptz default now()

);

```

## Avbetalningsmotorn — `src/lib/payoff.ts`

**Viktigt: all logik ligger i denna enda rena TS-fil. Inga beräkningar i komponenter, inga beräkningar i Supabase.** Funktionerna ska vara rena (inga sidoeffekter, ingen fetch) så att de går att testa isolerat.

### Effektiv ränta efter skatt

Ränteavdraget är avskaffat för lån utan säkerhet från inkomståret 2026. Studielån har aldrig varit avdragsgilla. Det ger tre fall:

```ts

function effectiveRate(loan: Loan): number {

  // CSN: aldrig avdragsgill

  if (loan.kind === 'csn') return loan.nominal_rate;

  // Lån med säkerhet (t.ex. billån med pant): 30 % avdrag kvarstår

  if (loan.has_collateral) return loan.nominal_rate * 0.7;

  // Allt annat utan säkerhet: inget avdrag från 2026

  return loan.nominal_rate;

}

```

Lägg en kommentar i koden: gränsen 30 % gäller upp till 100 000 kr i räntekostnad per år, därefter 21 %. Bygg **inte** in den brytpunkten i v1 — den är irrelevant vid dessa lånestorlekar, men ska dokumenteras.

### Räntemodell

- `interest_daily = true` (CSN): dag-för-dag-ränta på aktuell skuld. `dagsränta = saldo * (rate/100) / 365`. Extra inbetalning sänker räntan omedelbart.

- `interest_daily = false`: månadsränta, `saldo * (rate/100) / 12`, beräknad på ingående saldo.

### Simulering

```ts

simulate(loans: Loan[], extraPerMonth: number, strategy: 'avalanche' | 'snowball'): PayoffResult

```

Månad-för-månad-loop, max 600 iterationer:

1. Betala `min_payment` (eller `current_balance * min_payment_pct` för revolving, med golv på t.ex. 150 kr) + `monthly_fee` på varje lån.

2. Lägg hela `extraPerMonth` på **ett** mållån:

   - `avalanche` → högst `effectiveRate` först

   - `snowball` → lägst `current_balance` först

3. När ett lån når 0: rulla dess minimibetalning **plus** extrabeloppet vidare till nästa mållån (snöbollseffekten — detta är hela poängen, missa inte den).

4. Returnera: `months`, `debtFreeDate`, `totalInterest`, `perLoanPayoffDate[]`, `schedule[]` (saldo per lån per månad).

Kör alltid **båda** strategierna plus ett `baseline`-scenario med `extraPerMonth = 0`, så att UI kan visa skillnaden i sparade månader och sparade räntekronor.

### Revolving-lån

Kreditkort och kontokredit har ingen fast plan. Om `min_payment_pct` är satt och inget extra betalas ska simuleringen kunna returnera "betalas aldrig av" — visa det tydligt i UI istället för att loopa till 600.

## Sidor

1. **Dashboard** — total skuld, skuldfritt-datum, ränta per månad just nu, nästa förfallodag. En stapel per lån sorterad efter effektiv ränta.

2. **Lån** — lista + formulär. Visa nominell och effektiv ränta bredvid varandra, med en liten förklaring av varför de skiljer sig.

3. **Avbetalningsplan** — reglage för extra kr/mån, växel avalanche/snowball, kurva över total skuld tills 0, tabell med ordningsföljd och slutdatum per lån. Rubrik som svarar på frågan: "skuldfri i mars 2029 — 14 månader tidigare och 31 400 kr billigare".

4. **Budget** — kategorier per månad, planerat vs faktiskt, och raden "överskott tillgängligt för extraamortering" som matas direkt in i avbetalningsplanen.

5. **Transaktioner** — manuell inmatning, snabbformulär överst, filter på månad och kategori.

## Design

Mörkt gränssnitt, hög datatäthet, inga stora hjältesektioner. Tabulära siffror (`font-variant-numeric: tabular-nums`). Recharts för kurvor. Mobil först — jag kommer använda den i telefonen.

## Gör inte

- Ingen bankintegration, ingen Plaid/Tink/Enable, ingen filimport i v1

- Ingen bolånelogik: inget amorteringskrav, ingen belåningsgrad, ingen skuldkvot

- Ingen delad ekonomi, inga hushållsmedlemmar, inga inbjudningar

- Ingen AI-rådgivning eller chattfunktion

- Ingen localStorage för finansiell data — allt i Supabase

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://debt-away.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5a3cd62a-2a69-46a9-a11c-39c258d020ba).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
