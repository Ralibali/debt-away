import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  useAccounts,
  useAllLoanPayments,
  useBudgets,
  useCategories,
  useLoans,
  useParameters,
  useTransactions,
} from "@/lib/data";
import { summarize } from "@/lib/budget";
import { currentMonthlyInterest, minimumPayment, simulate } from "@/lib/payoff";
import { useSavingsAccounts } from "@/lib/savings";
import { useSinkingFunds } from "@/lib/rhythm";
import { totalMonthlyAccrual } from "@/lib/sinking";
import {
  COMMITMENT_KIND_LABELS,
  commitmentReleases,
  monthlyCommitmentTotal,
  useDeleteFinancialCommitment,
  useFinancialCommitments,
  useSaveFinancialCommitment,
  type CommitmentKind,
} from "@/lib/commitments";
import { detectRecurringPayments, financialVitals } from "@/lib/financial-os";
import {
  allocationPreview,
  buildCashflowForecast,
  stressTest,
} from "@/lib/financial-planning";
import { datum, kr, manad, monthStartISO, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/kontrollrum")({
  head: () => ({
    meta: [
      { title: "Kontrollrum — Skuldfri" },
      {
        name: "description",
        content: "Fasta åtaganden, 90-dagars kassaflöde, ekonomisk uthållighet och månadskoll.",
      },
    ],
  }),
  component: Kontrollrum,
});

const KINDS = Object.keys(COMMITMENT_KIND_LABELS) as CommitmentKind[];

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel p-4">
      <div className="label-xs">{label}</div>
      <div className="num mt-2 text-20">{value}</div>
      {sub && <div className="mt-1 text-12 text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Kontrollrum() {
  const today = todayISO();
  const month = monthStartISO();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: transactions = [] } = useTransactions(month, null);
  const { data: allTransactions = [] } = useTransactions(null, null);
  const { data: loans = [] } = useLoans();
  const { data: params } = useParameters();
  const { data: accounts = [] } = useAccounts();
  const { data: savings = [] } = useSavingsAccounts();
  const { data: funds = [] } = useSinkingFunds();
  const { data: payments = [] } = useAllLoanPayments();
  const {
    data: commitments = [],
    error: commitmentError,
  } = useFinancialCommitments();
  const saveCommitment = useSaveFinancialCommitment();
  const deleteCommitment = useDeleteFinancialCommitment();

  const [shock, setShock] = useState(15000);
  const [incomeDrop, setIncomeDrop] = useState(20);
  const [savingPct, setSavingPct] = useState(40);
  const [everydayPct, setEverydayPct] = useState(20);
  const [form, setForm] = useState({
    name: "",
    kind: "other" as CommitmentKind,
    monthly_amount: "",
    payment_day: "",
    starts_on: "",
    ends_on: "",
    notice_days: "",
    category_id: "",
    is_essential: false,
  });

  const summary = summarize(categories, budgets, transactions);
  const mappedCategories = new Set(
    commitments.filter((item) => item.active && item.category_id).map((item) => item.category_id!),
  );
  const unmappedFixedBudget = summary.lines
    .filter(
      (line) =>
        line.category.kind === "utgift" &&
        line.category.is_fixed &&
        !mappedCategories.has(line.category.id),
    )
    .reduce((sum, line) => sum + line.planned, 0);
  const commitmentMonthly = monthlyCommitmentTotal(commitments, today);
  const debtMinimum = loans.reduce(
    (sum, loan) => sum + minimumPayment(loan, loan.current_balance) + (loan.monthly_fee ?? 0),
    0,
  );
  const sinkingMonthly = totalMonthlyAccrual(funds);
  const plannedIncome = summary.plannedIncome || Number(params.monthly_net_income ?? 0);
  const liquidSavings = savings
    .filter((account) => account.is_buffer || account.kind === "buffert" || account.kind === "sparkonto")
    .reduce((sum, account) => sum + account.current_value, 0);
  const salaryBalance = accounts
    .filter((account) => account.kind === "lonekonto")
    .reduce((sum, account) => sum + account.balance, 0);
  const fallbackBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const startingBalance = salaryBalance || fallbackBalance;
  const interestAndFees =
    currentMonthlyInterest(loans) + loans.reduce((sum, loan) => sum + (loan.monthly_fee ?? 0), 0);

  const vitals = financialVitals({
    plannedIncome,
    fixedPlannedExpense: commitmentMonthly + unmappedFixedBudget + sinkingMonthly,
    minimumDebtPayments: debtMinimum,
    liquidSavings,
    monthlyInterestAndFees: interestAndFees,
  });

  const forecast = useMemo(
    () =>
      buildCashflowForecast({
        today,
        days: 90,
        startingBalance,
        monthlyIncome: plannedIncome,
        payday: params.payday,
        commitments,
        loans,
        sinkingFunds: funds,
      }),
    [today, startingBalance, plannedIncome, params.payday, commitments, loans, funds],
  );

  const essentialMonthly =
    commitments
      .filter((item) => item.active && item.is_essential)
      .reduce((sum, item) => sum + item.monthly_amount, 0) + debtMinimum;
  const stress = stressTest({
    liquidSavings,
    monthlyIncome: plannedIncome,
    essentialMonthly,
    shock,
    incomeDropPct: incomeDrop,
  });
  const allocation = allocationPreview(summary.plannedSurplus, savingPct, everydayPct);
  const releases = commitmentReleases(commitments, today);
  const recurring = useMemo(() => detectRecurringPayments(allTransactions), [allTransactions]);
  const base = simulate(loans, 0, "baseline", new Date(), params);
  const monthPayments = payments.filter((payment) => payment.paid_at.slice(0, 7) === month.slice(0, 7));
  const principalThisMonth = monthPayments.reduce(
    (sum, payment) => sum + (payment.principal_part ?? 0),
    0,
  );
  const interestThisMonth = monthPayments.reduce(
    (sum, payment) => sum + (payment.interest_part ?? 0),
    0,
  );
  const recurringAnnual = recurring.reduce((sum, row) => sum + row.annualAmount, 0);
  const upcoming = forecast.events.filter((event) => event.date >= today).slice(0, 12);

  async function addCommitment() {
    if (!form.name.trim() || !form.monthly_amount) {
      toast.error("Ange namn och månadskostnad");
      return;
    }
    try {
      await saveCommitment.mutateAsync({
        name: form.name.trim(),
        kind: form.kind,
        monthly_amount: Number(form.monthly_amount),
        payment_day: form.payment_day ? Number(form.payment_day) : null,
        starts_on: form.starts_on || null,
        ends_on: form.ends_on || null,
        notice_days: form.notice_days ? Number(form.notice_days) : null,
        category_id: form.category_id || null,
        is_essential: form.is_essential,
        active: true,
        notes: null,
      });
      setForm({
        name: "",
        kind: "other",
        monthly_amount: "",
        payment_day: "",
        starts_on: "",
        ends_on: "",
        notice_days: "",
        category_id: "",
        is_essential: false,
      });
      toast.success("Åtagandet är sparat");
    } catch {
      toast.error("Kunde inte spara. Kontrollera att databasuppdateringen är installerad.");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="label-xs">Ekonomiskt operativsystem</div>
        <h1 className="mt-1 text-24">Kontrollrum</h1>
        <p className="mt-2 max-w-2xl text-13 text-muted-foreground">
          Samma ekonomi, men sedd som kassaflöde, åtaganden, motståndskraft och vardagsutrymme.
          Beloppen ligger i din privata databas — inte i Git.
        </p>
      </div>

      {commitmentError && (
        <div className="panel border-dashed p-4 text-13 text-muted-foreground">
          Fasta åtaganden väntar på den nya databas-migrationen. Övriga delar av kontrollrummet
          fungerar fortfarande.
        </div>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <div className="label-xs">Ekonomiska vitalvärden</div>
            <h2 className="mt-1 text-18">Hur låst och tålig är ekonomin?</h2>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Låst per månad"
            value={kr(vitals.monthlyLocked)}
            sub="åtaganden + fasta poster + lån + årsavsättningar"
          />
          <Stat
            label="Låst andel"
            value={plannedIncome > 0 ? `${Math.round(vitals.fixedLoadPct)} %` : "–"}
            sub="av planerad månadsinkomst"
          />
          <Stat
            label="Likvid uthållighet"
            value={vitals.runwayMonths == null ? "–" : `${vitals.runwayMonths.toFixed(1)} mån`}
            sub={`${kr(liquidSavings)} i buffert/sparkonto`}
          />
          <Stat
            label="Ränta + avgifter / dag"
            value={kr(vitals.dailyInterestBurn)}
            sub={`${kr(interestAndFees)} per månad just nu`}
          />
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="label-xs">Fasta åtaganden</div>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-18">Det som följer med månad efter månad</h2>
            <span className="num text-13 text-muted-foreground">{kr(commitmentMonthly)}/mån</span>
          </div>
          <p className="mt-1 text-12 text-muted-foreground">
            Koppla gärna posten till samma budgetkategori. Då räknas den inte dubbelt i kontrollrummet.
          </p>
        </div>

        {commitments.length > 0 && (
          <div className="divide-y divide-border">
            {commitments.map((item) => (
              <div key={item.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-15 font-medium">{item.name}</span>
                    {!item.active && <span className="text-11 text-muted-foreground">inaktiv</span>}
                    {item.is_essential && (
                      <span className="inline-flex items-center gap-1 text-11 text-muted-foreground">
                        <ShieldCheck className="size-3" /> nödvändig
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-12 text-muted-foreground">
                    {COMMITMENT_KIND_LABELS[item.kind]}
                    {item.payment_day ? ` · dag ${item.payment_day}` : " · betalningsdag saknas"}
                    {item.ends_on ? ` · slutar ${datum(item.ends_on)}` : ""}
                  </div>
                </div>
                <div className="num text-14">{kr(item.monthly_amount)}/mån</div>
                <div className="flex items-center justify-end gap-3 text-12">
                  <button
                    className="underline underline-offset-4"
                    onClick={() =>
                      saveCommitment.mutate({
                        id: item.id,
                        name: item.name,
                        active: !item.active,
                      })
                    }
                  >
                    {item.active ? "Pausa" : "Aktivera"}
                  </button>
                  <button
                    aria-label="Ta bort åtagande"
                    onClick={() => deleteCommitment.mutate(item.id)}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-2 bg-background/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded-[6px] border border-border bg-background px-2 py-2 text-13"
            placeholder="Namn, t.ex. boende"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          <select
            className="rounded-[6px] border border-border bg-background px-2 py-2 text-13"
            value={form.kind}
            onChange={(event) => setForm({ ...form, kind: event.target.value as CommitmentKind })}
          >
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {COMMITMENT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="decimal"
            className="num rounded-[6px] border border-border bg-background px-2 py-2 text-13"
            placeholder="Kr / månad"
            value={form.monthly_amount}
            onChange={(event) => setForm({ ...form, monthly_amount: event.target.value })}
          />
          <input
            type="number"
            min="1"
            max="31"
            className="num rounded-[6px] border border-border bg-background px-2 py-2 text-13"
            placeholder="Betalningsdag"
            value={form.payment_day}
            onChange={(event) => setForm({ ...form, payment_day: event.target.value })}
          />
          <select
            className="rounded-[6px] border border-border bg-background px-2 py-2 text-13"
            value={form.category_id}
            onChange={(event) => setForm({ ...form, category_id: event.target.value })}
          >
            <option value="">Ingen budgetkoppling</option>
            {categories
              .filter((category) => category.kind === "utgift")
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
          </select>
          <label className="text-12 text-muted-foreground">
            <span className="label-xs">Startdatum</span>
            <input
              type="date"
              className="mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-2 text-13"
              value={form.starts_on}
              onChange={(event) => setForm({ ...form, starts_on: event.target.value })}
            />
          </label>
          <label className="text-12 text-muted-foreground">
            <span className="label-xs">Slutdatum</span>
            <input
              type="date"
              className="mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-2 text-13"
              value={form.ends_on}
              onChange={(event) => setForm({ ...form, ends_on: event.target.value })}
            />
          </label>
          <div className="flex items-end gap-2">
            <label className="flex min-h-9 flex-1 items-center gap-2 rounded-[6px] border border-border px-2 text-12">
              <input
                type="checkbox"
                checked={form.is_essential}
                onChange={(event) => setForm({ ...form, is_essential: event.target.checked })}
              />
              Nödvändig kostnad
            </label>
            <button
              onClick={addCommitment}
              className="flex min-h-9 items-center gap-1 rounded-[6px] bg-signal px-3 text-13 font-medium text-primary-foreground"
            >
              <Plus className="size-3.5" /> Lägg till
            </button>
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="label-xs">90 dagar</div>
            <h2 className="mt-1 text-18">Kassaflödesradar</h2>
            <p className="mt-1 max-w-xl text-12 text-muted-foreground">
              Prognosen använder betalningsdagar, planerad månadsinkomst och kända årsutgifter.
              Poster utan betalningsdag hålls utanför datumprognosen och visas separat.
            </p>
          </div>
          <CalendarClock className="size-5 text-muted-foreground" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="Lägsta prognossaldo" value={kr(forecast.lowestBalance)} sub={datum(forecast.lowestDate)} />
          <Stat label="Saldo om 90 dagar" value={kr(forecast.endBalance)} sub={`start ${kr(startingBalance)}`} />
          <Stat
            label="Ej datumplacerat"
            value={kr(forecast.unplacedMonthly)}
            sub="månadskostnad som saknar betalningsdag"
          />
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <div className="label-xs">Nästa kända händelser</div>
          {upcoming.length === 0 ? (
            <p className="mt-2 text-12 text-muted-foreground">Lägg in betalningsdagar för att fylla kalendern.</p>
          ) : (
            <div className="mt-2 divide-y divide-border">
              {upcoming.map((event, index) => (
                <div key={`${event.date}-${event.label}-${index}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] gap-3 py-2 text-12">
                  <span className="text-muted-foreground">{datum(event.date)}</span>
                  <span className="truncate">{event.label}</span>
                  <span className="num">{event.amount >= 0 ? "+" : ""}{kr(event.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <div className="label-xs">Stresstest</div>
          <h2 className="mt-1 text-18">Vad händer om månaden blir sämre?</h2>
          <label className="mt-4 block text-13">
            Oväntad utgift: <span className="num">{kr(shock)}</span>
            <input
              className="mt-2 w-full accent-current"
              type="range"
              min="0"
              max="50000"
              step="1000"
              value={shock}
              onChange={(event) => setShock(Number(event.target.value))}
            />
          </label>
          <label className="mt-4 block text-13">
            Inkomstfall: <span className="num">{incomeDrop} %</span>
            <input
              className="mt-2 w-full accent-current"
              type="range"
              min="0"
              max="100"
              step="5"
              value={incomeDrop}
              onChange={(event) => setIncomeDrop(Number(event.target.value))}
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div>
              <div className="label-xs">Buffert efter smäll</div>
              <div className="num mt-1 text-18">{kr(stress.balanceAfterShock)}</div>
            </div>
            <div>
              <div className="label-xs">Månadsunderskott</div>
              <div className="num mt-1 text-18">{kr(stress.monthlyGap)}</div>
            </div>
          </div>
          <p className="mt-3 text-12 text-muted-foreground">
            {stress.runwayMonths == null
              ? "Efter valt inkomstfall täcker den återstående inkomsten de kostnader som är markerade som nödvändiga plus minimibetalningarna på lån."
              : `Med de här antagandena täcker den likvida bufferten underskottet i cirka ${stress.runwayMonths.toLocaleString("sv-SE")} månader.`}
          </p>
        </div>

        <div className="panel p-4">
          <div className="label-xs">Fördelningslabbet</div>
          <h2 className="mt-1 text-18">Ge överskottet tre jobb</h2>
          <p className="mt-1 text-12 text-muted-foreground">
            Du bestämmer procentsatserna. Resten visas som utrymme för skuldminskning.
          </p>
          <label className="mt-4 block text-13">
            Sparande: <span className="num">{savingPct} %</span>
            <input
              className="mt-2 w-full accent-current"
              type="range"
              min="0"
              max="100"
              step="5"
              value={savingPct}
              onChange={(event) => {
                const value = Number(event.target.value);
                setSavingPct(value);
                if (value + everydayPct > 100) setEverydayPct(100 - value);
              }}
            />
          </label>
          <label className="mt-4 block text-13">
            Vardag utan dåligt samvete: <span className="num">{everydayPct} %</span>
            <input
              className="mt-2 w-full accent-current"
              type="range"
              min="0"
              max={100 - savingPct}
              step="5"
              value={everydayPct}
              onChange={(event) => setEverydayPct(Number(event.target.value))}
            />
          </label>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
            <div>
              <div className="label-xs">Spara</div>
              <div className="num mt-1 text-16">{kr(allocation.saving)}</div>
            </div>
            <div>
              <div className="label-xs">Skuld</div>
              <div className="num mt-1 text-16">{kr(allocation.debt)}</div>
            </div>
            <div>
              <div className="label-xs">Vardag</div>
              <div className="num mt-1 text-16">{kr(allocation.everyday)}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel p-4">
        <div className="label-xs">Frihetslinjen</div>
        <h2 className="mt-1 text-18">När försvinner bundna kostnader?</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[6px] border border-border p-3">
            <div className="label-xs">Skuldfri med nuvarande plan</div>
            <div className="num mt-1 text-20">{base.months ? manad(base.debtFreeDate) : "Ingen prognos"}</div>
            <div className="mt-1 text-12 text-muted-foreground">
              {base.months ? `${base.months} månader` : "minimibetalningarna ger ingen slutpunkt i modellen"}
            </div>
          </div>
          <div className="rounded-[6px] border border-border p-3">
            <div className="label-xs">Nästa åtagande som löper ut</div>
            {releases[0] ? (
              <>
                <div className="num mt-1 text-20">{datum(releases[0].date)}</div>
                <div className="mt-1 text-12 text-muted-foreground">
                  {releases[0].names.join(", ")} · {kr(releases[0].amount)}/mån i nuvarande kostnad
                </div>
              </>
            ) : (
              <div className="mt-2 text-12 text-muted-foreground">Inga slutdatum inlagda ännu.</div>
            )}
          </div>
        </div>
        {releases.length > 1 && (
          <div className="mt-3 divide-y divide-border border-t border-border">
            {releases.slice(1, 6).map((release) => (
              <div key={release.date} className="flex justify-between gap-4 py-2 text-12">
                <span>{datum(release.date)} · {release.names.join(", ")}</span>
                <span className="num">{kr(release.amount)}/mån</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel p-4">
        <div className="label-xs">Månadsbokslut hittills</div>
        <h2 className="mt-1 text-18">Vad har faktiskt hänt?</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="label-xs">Faktiskt överskott</div>
            <div className="num mt-1 text-18">{kr(summary.actualSurplus)}</div>
          </div>
          <div>
            <div className="label-xs">Amorterat kapital</div>
            <div className="num mt-1 text-18">{kr(principalThisMonth)}</div>
          </div>
          <div>
            <div className="label-xs">Registrerad låneränta</div>
            <div className="num mt-1 text-18">{kr(interestThisMonth)}</div>
          </div>
          <div>
            <div className="label-xs">Återkommande mönster</div>
            <div className="num mt-1 text-18">{recurring.length}</div>
            <div className="mt-1 text-11 text-muted-foreground">ca {kr(recurringAnnual)}/år</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          <Link to="/budget" className="rounded-[6px] border border-border px-3 py-2 text-13">
            Granska budgeten
          </Link>
          <Link to="/import" className="rounded-[6px] border border-border px-3 py-2 text-13">
            Importera kontoutdrag
          </Link>
          <Link to="/rytm" className="rounded-[6px] border border-border px-3 py-2 text-13">
            Årsutgifter & buffertposter
          </Link>
          <Link to="/plan" className="rounded-[6px] bg-signal px-3 py-2 text-13 font-medium text-primary-foreground">
            Se skuldscenarier
          </Link>
        </div>
      </section>
    </div>
  );
}
