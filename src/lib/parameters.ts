/**
 * Manuella parametrar — alla konstanter som annars skulle ligga hårdkodade
 * i beräkningarna. Ren TypeScript: inga hooks, ingen fetch.
 *
 * Varje beräkningsfunktion tar emot dessa som argument. Standardvärdena här
 * gäller inkomståret 2026 och används tills användaren sparat egna värden.
 */

export interface UserParameters {
  // skatt och regler
  isk_fribelopp: number;
  isk_schablonranta: number;
  kapitalskatt: number;
  ranteavdrag_sakerhet: number;
  ranteavdrag_utan_sakerhet: number;
  // ekonomi
  monthly_net_income: number | null;
  hourly_net_wage: number | null;
  buffer_months: number;
  expected_return: number;
  // beteende
  cooldown_small_hours: number;
  cooldown_medium_days: number;
  cooldown_large_days: number;
  cooldown_small_limit: number;
  cooldown_large_limit: number;
  // rytm och familj
  child_allowance_total: number;
  child_allowance_share: number;
  child_allowance_day: number;
  payday: number;
  notifications_paused_until?: string | null;
  updated_at?: string | null;
}

export const DEFAULT_PARAMETERS: UserParameters = {
  isk_fribelopp: 300_000,
  isk_schablonranta: 0.0355,
  kapitalskatt: 0.3,
  ranteavdrag_sakerhet: 0.3,
  ranteavdrag_utan_sakerhet: 0,
  monthly_net_income: null,
  hourly_net_wage: null,
  buffer_months: 3,
  expected_return: 0.07,
  cooldown_small_hours: 48,
  cooldown_medium_days: 7,
  cooldown_large_days: 30,
  cooldown_small_limit: 500,
  cooldown_large_limit: 2000,
  child_allowance_total: 2650,
  child_allowance_share: 0.5,
  child_allowance_day: 20,
  payday: 25,
  notifications_paused_until: null,
  updated_at: null,
};

export type ParamKey = keyof Omit<UserParameters, "updated_at" | "notifications_paused_until">;

export type ParamKind = "percent" | "amount" | "int" | "hours" | "day";

export interface ParamField {
  key: ParamKey;
  label: string;
  kind: ParamKind;
  group: "skatt" | "ekonomi" | "beteende" | "rytm";
  /** Var värdet används — visas i gränssnittet så inget tal är oförklarat. */
  usedBy: string;
  hint?: string;
  optional?: boolean;
}

export const PARAM_FIELDS: ParamField[] = [
  {
    key: "isk_fribelopp",
    label: "ISK-fribelopp",
    kind: "amount",
    group: "skatt",
    usedBy: "Sparande → schablonskatt och fribeloppsmätaren",
    hint: "300 000 kr från 2026, gemensamt för ISK, KF och PEPP.",
  },
  {
    key: "isk_schablonranta",
    label: "Schablonränta",
    kind: "percent",
    group: "skatt",
    usedBy: "Sparande → schablonskatt",
    hint: "Statslåneränta 30 nov föregående år + 1 procentenhet, golv 1,25 %.",
  },
  {
    key: "kapitalskatt",
    label: "Kapitalskatt",
    kind: "percent",
    group: "skatt",
    usedBy: "Sparande → schablonskatt",
  },
  {
    key: "ranteavdrag_sakerhet",
    label: "Ränteavdrag, lån med säkerhet",
    kind: "percent",
    group: "skatt",
    usedBy: "Lån, Plan, Köpbeslut → effektiv ränta",
    hint: "30 % upp till 100 000 kr i årlig räntekostnad.",
  },
  {
    key: "ranteavdrag_utan_sakerhet",
    label: "Ränteavdrag, lån utan säkerhet",
    kind: "percent",
    group: "skatt",
    usedBy: "Lån, Plan, Köpbeslut → effektiv ränta",
    hint: "Avskaffat från inkomståret 2026 — sätt till 0 %.",
  },
  {
    key: "monthly_net_income",
    label: "Nettoinkomst per månad",
    kind: "amount",
    group: "ekonomi",
    usedBy: "Budget och Utgiftsläckor när transaktioner saknas",
    optional: true,
  },
  {
    key: "hourly_net_wage",
    label: "Nettolön per timme",
    kind: "amount",
    group: "ekonomi",
    usedBy: "Köpbeslut → vad köpet kostar i arbetstimmar",
    optional: true,
  },
  {
    key: "buffer_months",
    label: "Buffert i månader",
    kind: "int",
    group: "ekonomi",
    usedBy: "Sparande → buffertmål och kapitalrådgivning",
  },
  {
    key: "expected_return",
    label: "Förväntad avkastning",
    kind: "percent",
    group: "ekonomi",
    usedBy: "Sparande → amortera eller spara",
  },
  {
    key: "cooldown_small_hours",
    label: "Kylperiod, små köp (timmar)",
    kind: "hours",
    group: "beteende",
    usedBy: "Önskelistan",
  },
  {
    key: "cooldown_medium_days",
    label: "Kylperiod, mellanköp (dagar)",
    kind: "int",
    group: "beteende",
    usedBy: "Önskelistan",
  },
  {
    key: "cooldown_large_days",
    label: "Kylperiod, stora köp (dagar)",
    kind: "int",
    group: "beteende",
    usedBy: "Önskelistan",
  },
  {
    key: "cooldown_small_limit",
    label: "Gräns för litet köp",
    kind: "amount",
    group: "beteende",
    usedBy: "Önskelistan",
  },
  {
    key: "cooldown_large_limit",
    label: "Gräns för stort köp",
    kind: "amount",
    group: "beteende",
    usedBy: "Önskelistan",
  },
  {
    key: "child_allowance_total",
    label: "Barnbidrag totalt per månad",
    kind: "amount",
    group: "rytm",
    usedBy: "Rytm → schemalagd inkomst den 20:e",
    hint: "2 650 kr för två barn inklusive flerbarnstillägg.",
  },
  {
    key: "child_allowance_share",
    label: "Din andel av barnbidraget",
    kind: "percent",
    group: "rytm",
    usedBy: "Rytm → schemalagd inkomst",
    hint: "50 % vid delat bidrag och växelvis boende.",
  },
  {
    key: "child_allowance_day",
    label: "Utbetalningsdag barnbidrag",
    kind: "day",
    group: "rytm",
    usedBy: "Rytm och aviseringar",
  },
  {
    key: "payday",
    label: "Lönedag",
    kind: "day",
    group: "rytm",
    usedBy: "Daglig siffra, intentioner och aviseringar",
  },
];

export const PARAM_GROUP_LABELS: Record<ParamField["group"], string> = {
  skatt: "Skatt och regler",
  ekonomi: "Ekonomi",
  beteende: "Beteende",
  rytm: "Rytm och familj",
};

/** Slår ihop en delvis rad från databasen med standardvärdena. */
export function withDefaults(row: Partial<UserParameters> | null | undefined): UserParameters {
  if (!row) return { ...DEFAULT_PARAMETERS };
  const out = { ...DEFAULT_PARAMETERS };
  for (const f of PARAM_FIELDS) {
    const v = row[f.key];
    if (v == null) {
      if (f.optional) out[f.key] = null as never;
      continue;
    }
    out[f.key] = Number(v) as never;
  }
  out.notifications_paused_until = row.notifications_paused_until ?? null;
  out.updated_at = row.updated_at ?? null;
  return out;
}

/** Visningsvärde för ett fält (procent visas som procenttal, inte andel). */
export function paramToInput(p: UserParameters, f: ParamField): string {
  const v = p[f.key];
  if (v == null) return "";
  return f.kind === "percent" ? String(Math.round(Number(v) * 10000) / 100) : String(v);
}

/** Tolkar ett inmatat värde tillbaka till lagringsformat. */
export function inputToParam(raw: string, f: ParamField): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (f.kind === "percent") return Math.round((n / 100) * 1e6) / 1e6;
  if (f.kind === "int" || f.kind === "hours" || f.kind === "day") return Math.round(n);
  return n;
}
