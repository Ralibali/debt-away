import { createFileRoute, Link } from "@tanstack/react-router";
import { useLoans } from "@/lib/data";
import { currentMonthlyInterest, effectiveRate, minimumPayment, simulate } from "@/lib/payoff";
import { kr, procent, manad, LOAN_KIND_LABELS } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Översikt — Skuldfri" },
      { name: "description", content: "Total skuld, skuldfritt datum och ränta per månad." },
      { property: "og:title", content: "Översikt — Skuldfri" },
      {
        property: "og:description",
        content: "Total skuld, skuldfritt datum och ränta per månad.",
      },
    ],
  }),
  component: Dashboard,
});

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel p-3">
      <div className="label-xs">{label}</div>
      <div className="num mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function nextDueDate(days: (number | null)[]): string {
  const today = new Date();
  const valid = days.filter((d): d is number => d != null);
  if (valid.length === 0) return "–";
  const candidates = valid.map((d) => {
    const inThisMonth = new Date(today.getFullYear(), today.getMonth(), d);
    return inThisMonth >= new Date(today.getFullYear(), today.getMonth(), today.getDate())
      ? inThisMonth
      : new Date(today.getFullYear(), today.getMonth() + 1, d);
  });
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0]!.toLocaleDateString("sv-SE");
}

function Dashboard() {
  const { data: loans = [], isLoading } = useLoans();

  const total = loans.reduce((s, l) => s + l.current_balance, 0);
  const interest = currentMonthlyInterest(loans);
  const minSum = loans.reduce((s, l) => s + minimumPayment(l, l.current_balance) + (l.monthly_fee ?? 0), 0);
  const base = simulate(loans, 0, "baseline");
  const sorted = [...loans].sort((a, b) => effectiveRate(b) - effectiveRate(a));
  const max = Math.max(1, ...loans.map((l) => l.current_balance));

  return (
    <div className="space-y-3">
      <h1 className="px-1 text-base font-semibold tracking-tight">Översikt</h1>

      {isLoading ? (
        <p className="px-1 text-sm text-muted-foreground">Laddar…</p>
      ) : loans.length === 0 ? (
        <div className="panel p-6 text-center">
          <p className="text-sm text-muted-foreground">Inga lån inlagda ännu.</p>
          <Link to="/lan" className="mt-3 inline-block text-sm font-medium text-primary">
            Lägg till ditt första lån →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Total skuld" value={kr(total)} sub={`${loans.length} lån`} />
            <Stat
              label="Skuldfri (utan extra)"
              value={base.months ? manad(base.debtFreeDate) : "Aldrig"}
              sub={base.months ? `om ${base.months} mån` : "minimibetalning räcker inte"}
            />
            <Stat
              label="Ränta per månad"
              value={kr(interest)}
              sub={`${kr(interest * 12)} per år`}
            />
            <Stat
              label="Minimibetalning"
              value={kr(minSum)}
              sub={`Nästa förfallodag ${nextDueDate(loans.map((l) => l.payment_day))}`}
            />
          </div>

          <div className="panel p-3">
            <div className="label-xs mb-2">Lån sorterade efter effektiv ränta</div>
            <div className="space-y-2.5">
              {sorted.map((l) => (
                <div key={l.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{l.name}</span>
                    <span className="num shrink-0 text-muted-foreground">
                      {procent(effectiveRate(l))} · {kr(l.current_balance)}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(l.current_balance / max) * 100}%` }}
                    />
                  </div>
                  <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
                    {LOAN_KIND_LABELS[l.kind]} · nominellt {procent(l.nominal_rate)}
                    {l.interest_daily ? " · dagsränta" : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Link
            to="/plan"
            className="block rounded-lg bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground"
          >
            Räkna ut hur du blir skuldfri snabbare
          </Link>
        </>
      )}
    </div>
  );
}
