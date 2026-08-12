const sek = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0,
});

const sekDecimals = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pct = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export function kr(value: number | null | undefined, decimals = false): string {
  if (value == null || Number.isNaN(value)) return "–";
  return (decimals ? sekDecimals : sek).format(value);
}

export function procent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${pct.format(value)} %`;
}

export function manad(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat("sv-SE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function datum(iso: string | null | undefined): string {
  if (!iso) return "–";
  return iso.slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export const LOAN_KIND_LABELS: Record<string, string> = {
  csn: "CSN",
  billan: "Billån",
  privatlan: "Privatlån",
  kreditkort: "Kreditkort",
  kontokredit: "Kontokredit",
};

export const ACCOUNT_KIND_LABELS: Record<string, string> = {
  lonekonto: "Lönekonto",
  sparkonto: "Sparkonto",
  kontant: "Kontant",
  ovrigt: "Övrigt",
};
