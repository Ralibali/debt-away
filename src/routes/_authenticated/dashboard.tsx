import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useAllLoanPayments,
  useBudgets,
  useCategories,
  useLoans,
  principalByMonth,
  useTransactions,
  useParameters,
} from "@/lib/data";
import { summarize } from "@/lib/budget";
import {
  currentMonthlyInterest,
  effectiveRate,
  minimumPayment,
  simulate,
} from "@/lib/payoff";
import { averageMonthlyDeposits, useSavingsAccounts, useSavingsSnapshots } from "@/lib/savings";
import { crossoverSeries } from "@/lib/networth";
import { capitalAdvice } from "@/lib/capital";
import { kr, procent, manad, monthStartISO, LOAN_KIND_LABELS } from "@/lib/format";
import { CrossoverChart } from "@/components/charts/CrossoverChart";
import { CountUp } from "@/components/CountUp";
import { DailyNumberPanel } from "@/components/DailyNumberPanel";
import { useDaily } from "@/lib/useDaily";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Översikt — Skuldfri" },
      {
        name: "description",
        content:
          "Nettoförmögenhet, korspunkten mellan skuld och sparande, ränta per månad och skuldfritt datum.",
      },
      { property: "og:title", content: "Översikt — Skuldfri" },
      {
        property: "og:description",
        content: "Nettoförmögenhet och korspunkten mellan skuld och sparande.",
      },
    ],
  }),
  component: Dashboard,
});

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel p-4">
      <div className="label-xs">{label}</div>
      <div className="num mt-2 text-18">{value}</div>
      {sub && <div className="mt-1 text-13 text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Dashboard() {
  const { daily } = useDaily();
  const { data: loans = [], isLoading } = useLoans();
  const { data: params } = useParameters();
  const { data: savings = [] } = useSavingsAccounts();
  const { data: snapshots = [] } = useSavingsSnapshots();
  const { data: payments = [] } = useAllLoanPayments();

  const month = monthStartISO();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: transactions = [] } = useTransactions(month, null);
  const summary = summarize(categories, budgets, transactions);

  const deposits = useMemo(() => averageMonthlyDeposits(snapshots), [snapshots]);
  const series = useMemo(
    () =>
      crossoverSeries({
        loans,
        snapshots,
        principalByMonth: principalByMonth(payments),
        monthlyDeposits: deposits,
        extraPerMonth: 0,
        strategy: "avalanche",
      }),
    [loans, snapshots, payments, deposits],
  );

  const total = loans.reduce((s, l) => s + l.current_balance, 0);
  const interest = currentMonthlyInterest(loans);
  const minSum = loans.reduce(
    (s, l) => s + minimumPayment(l, l.current_balance) + (l.monthly_fee ?? 0),
    0,
  );
  const base = simulate(loans, 0, "baseline", new Date(), params);
  const savingsTotal = savings.reduce((s, a) => s + a.current_value, 0);
  const sorted = [...loans].sort((a, b) => effectiveRate(b, params) - effectiveRate(a, params));
  const max = Math.max(1, ...loans.map((l) => l.current_balance));

  const advice = capitalAdvice(
    {
      loans,
      savings,
      avgMonthlyExpenses: summary.actualExpense || summary.plannedExpense,
      monthlySurplus: summary.plannedSurplus,
    },
    params,
  );

  const empty = loans.length === 0 && savings.length === 0;

  return (
    <div className="space-y-8">
      <h1 className="text-24">Översikt</h1>

      {loans.length > 0 && (
        <section className="panel p-4">
          <div className="label-xs">Skuldfri</div>
          <div className="display mt-1 text-40 leading-none sm:text-64">
            {base.months ? manad(base.debtFreeDate) : "Aldrig"}
          </div>
          <p className="mt-3 text-15 text-muted-foreground">
            Ränta och avgifter kostar dig{" "}
            <span className="num text-ink">{kr(interest + feeSum)}</span> i månaden.
          </p>
        </section>
      )}

      <DailyNumberPanel daily={daily} />

      {isLoading ? (
        <p className="text-13 text-muted-foreground">Laddar…</p>
      ) : empty ? (
        <div className="panel p-6">
          <p className="text-15">Inga lån inlagda än.</p>
          <p className="mt-1 text-13 text-muted-foreground">
            Lägg till ditt första för att se en avbetalningsplan och korspunkten mellan skuld
            och sparande.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/lan"
              className="rounded-[6px] bg-signal px-4 py-2 text-15 font-medium text-primary-foreground"
            >
              Lägg till lån
            </Link>
            <Link
              to="/sparande"
              className="rounded-[6px] border border-border px-4 py-2 text-15 font-medium"
            >
              Lägg till sparkonto
            </Link>
          </div>
        </div>
      ) : (
        <>
          <section className="panel p-4">
            <div className="label-xs">Korspunkten</div>
            <p className="mt-1 text-13 text-muted-foreground">
              När vänder mitt netto positivt? Skuld under linjen, sparande över.
            </p>
            <div className="mt-4">
              <CrossoverChart series={series} />
            </div>
            <div className="mt-4 border-t border-border pt-4">
              <div className="label-xs">Nettoförmögenhet nu</div>
              <div className="display mt-1 text-40 leading-none sm:text-64">
                <CountUp value={series.netToday} format={(v) => kr(v)} />
              </div>
              <p className="mt-3 max-w-prose text-15 text-muted-foreground">
                {series.netToday >= 0
                  ? `Nettot är redan positivt. Med nuvarande takt växer det med ${kr(
                      deposits,
                    )} i sparande per månad.`
                  : series.crossoverDate
                    ? `Vid nuvarande takt vänder nettot positivt i ${manad(
                        series.crossoverDate,
                      )}, om ${series.monthsToCrossover} månader.`
                    : "Vid nuvarande takt vänder nettot inte positivt inom tio år. Höj amorteringen eller sparandet för att flytta korspunkten."}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Stat label="Total skuld" value={kr(total)} sub={`${loans.length} lån`} />
            <Stat
              label="Sparande"
              value={kr(savingsTotal)}
              sub={`${savings.length} konton · ${kr(deposits)} insatt per månad`}
            />
            <Stat
              label="Skuldfri utan extra"
              value={base.months ? manad(base.debtFreeDate) : "Aldrig"}
              sub={base.months ? `om ${base.months} månader` : "minimibetalning räcker inte"}
            />
            <Stat
              label="Ränta per månad"
              value={kr(interest)}
              sub={`${kr(interest * 12)} per år · minimibetalning ${kr(minSum)}`}
            />
          </div>

          {loans.length > 0 && (
            <section className="panel p-4">
              <div className="label-xs">Lån sorterade efter effektiv ränta</div>
              <ul className="mt-4 space-y-4">
                {sorted.map((l) => (
                  <li key={l.id}>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-4">
                      <span className="truncate text-15 font-medium">{l.name}</span>
                      <span className="num shrink-0 text-13 text-muted-foreground">
                        {procent(effectiveRate(l, params))} · {kr(l.current_balance)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full bg-background">
                      <div
                        className="h-full bg-debt"
                        style={{ width: `${(l.current_balance / max) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 text-13 text-muted-foreground">
                      {LOAN_KIND_LABELS[l.kind]} · nominellt {procent(l.nominal_rate)}
                      {l.interest_daily ? " · dagsränta" : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="panel p-4">
            <div className="label-xs">Överskottet just nu</div>
            <p className="mt-2 max-w-prose text-15">{advice.message}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-13 text-muted-foreground">
              <span>
                Buffert <span className="num">{kr(advice.bufferValue)}</span> av{" "}
                <span className="num">
                  {advice.bufferTarget > 0 ? kr(advice.bufferTarget) : "–"}
                </span>
              </span>

              <Link to="/sparande" className="underline underline-offset-4">
                Sparande och avstämning
              </Link>
            </div>
          </section>

          <Link
            to="/plan"
            className="block rounded-[6px] bg-signal px-4 py-3 text-center text-15 font-medium text-primary-foreground"
          >
            Räkna ut hur du blir skuldfri snabbare
          </Link>
        </>
      )}
    </div>
  );
}
