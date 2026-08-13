import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRightLeft,
  Droplets,
  HandCoins,
  ListChecks,
  PiggyBank,
  ShoppingBag,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import {
  useBudgets,
  useCategories,
  useLoans,
  useParameters,
  useTransactions,
} from "@/lib/data";
import { summarize } from "@/lib/budget";
import { capitalAdvice } from "@/lib/capital";
import { effectiveRate } from "@/lib/payoff";
import { useDaily } from "@/lib/useDaily";
import { useSavingsAccounts } from "@/lib/savings";
import { analyzeLoanComparison } from "@/lib/refinance";
import { kr, monthStartISO, procent } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "Ekonomisk assistent — Skuldfri" },
      {
        name: "description",
        content:
          "Daglig privatekonomisk assistent med utrymme att leva, sparfokus, skuldplan och villkorskoll för lån.",
      },
      { property: "og:title", content: "Ekonomisk assistent — Skuldfri" },
      {
        property: "og:description",
        content: "Dagens ekonomiska läge, nästa prioritet och långsiktig skuld- och sparplan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CoachHub,
});

const MODULES = [
  {
    to: "/lackor",
    icon: Droplets,
    title: "Utgiftsläckor",
    text: "Hittar prenumerationer, budgetöverdrag och småköp i din faktiska historik.",
  },
  {
    to: "/plan",
    icon: Target,
    title: "Skuldstrategi",
    text: "Lavin, snöboll och hybrid räknat på dina lån — med tydlig effekt på datum och ränta.",
  },
  {
    to: "/budgetplan",
    icon: ListChecks,
    title: "Budget utan skam",
    text: "Fördelar det du faktiskt har kvar. Inga mallar, inga pekpinnar.",
  },
  {
    to: "/onskelista",
    icon: HandCoins,
    title: "Impulsbroms",
    text: "Önskelista med kylperiod, humörlogg och beslutsblad.",
  },
  {
    to: "/kopbeslut",
    icon: ShoppingBag,
    title: "Köpbeslut",
    text: "Totalkostnad, effektiv ränta, timmar av lön och vad köpet kostar i skuldfrihet.",
  },
] as const;

function CoachHub() {
  const { daily } = useDaily();
  const { data: loans = [] } = useLoans();
  const { data: params } = useParameters();
  const { data: savings = [] } = useSavingsAccounts();
  const month = monthStartISO();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: transactions = [] } = useTransactions(month, null);

  const summary = useMemo(
    () => summarize(categories, budgets, transactions),
    [categories, budgets, transactions],
  );

  const advice = useMemo(
    () =>
      capitalAdvice(
        {
          loans,
          savings,
          avgMonthlyExpenses: summary.actualExpense || summary.plannedExpense,
          monthlySurplus: summary.plannedSurplus,
        },
        params,
      ),
    [loans, savings, summary.actualExpense, summary.plannedExpense, summary.plannedSurplus, params],
  );

  const comparison = useMemo(() => analyzeLoanComparison(loans, params), [loans, params]);
  const topLoan = useMemo(
    () =>
      loans
        .filter((loan) => loan.current_balance > 0.005)
        .sort((a, b) => effectiveRate(b, params) - effectiveRate(a, params))[0] ?? null,
    [loans, params],
  );

  const savingsTotal = savings.reduce((sum, account) => sum + account.current_value, 0);
  const bufferLeft = Math.max(0, advice.bufferTarget - advice.bufferValue);

  return (
    <div className="space-y-6">
      <div className="px-1">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="size-4" />
          <span className="label-xs text-primary">Din dagliga assistent</span>
        </div>
        <h1 className="mt-1 text-24">Ekonomin ska fungera i vardagen också.</h1>
        <p className="mt-1 max-w-2xl text-13 text-muted-foreground">
          Först skyddas pengar till räkningar, lån och planerade avsättningar. Därefter ser du vad
          som faktiskt är fritt att leva för — samtidigt som sparande och skuld rör sig åt rätt håll.
        </p>
      </div>

      <section className="grid gap-2 md:grid-cols-3">
        <AssistantCard
          icon={Wallet}
          eyebrow="Idag"
          title={`${kr(Math.max(0, daily.perDay))} per dag`}
          text={
            daily.remaining >= 0
              ? `${kr(daily.remaining)} är kvar att röra dig med under nuvarande fas efter reserverade poster.`
              : `Nuvarande fas ligger ${kr(Math.abs(daily.remaining))} under reserverad nivå. Se budgeten innan nya fria köp.`
          }
          to="/dashboard"
          link="Se uträkningen"
        />

        <AssistantCard
          icon={PiggyBank}
          eyebrow="Sparande"
          title={
            advice.bufferStatus === "uppfylld"
              ? `${kr(savingsTotal)} sparat`
              : `${kr(bufferLeft)} kvar till buffertmål`
          }
          text={advice.message}
          to="/sparande"
          link="Öppna sparandet"
        />

        <AssistantCard
          icon={Target}
          eyebrow="Skuld"
          title={topLoan ? `${topLoan.name} · ${procent(effectiveRate(topLoan, params))}` : "Ingen aktiv skuld"}
          text={
            topLoan
              ? "Det här är den dyraste aktiva skulden efter dina skatteparametrar. Planen visar vad extra amortering gör med slutdatumet."
              : "När lånen är borta kan samma månadsutrymme flyttas över till sparmål i stället."
          }
          to="/plan"
          link="Se skuldplanen"
        />
      </section>

      <section className="panel p-4">
        <div className="flex items-start gap-3">
          <ArrowRightLeft className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="label-xs">Villkorskoll för lån</div>
            <h2 className="mt-1 text-18">
              {comparison.status === "flera"
                ? `${comparison.loans.length} osäkrade lån registrerade`
                : comparison.status === "ett"
                  ? "Ett osäkrat lån registrerat"
                  : "Inga osäkrade lån att jämföra"}
            </h2>

            {comparison.status === "flera" ? (
              <>
                <p className="mt-2 max-w-prose text-13 text-muted-foreground">
                  Flera osäkrade lån är en signal att åtminstone kontrollera om ett samlat alternativ
                  skulle ge lägre total kostnad. Bedöm alltid ränta, avgifter och löptid tillsammans —
                  ett lägre månadsbelopp kan annars bli dyrare över tid.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label="Saldo" value={kr(comparison.totalBalance)} />
                  <Metric label="Viktad ränta" value={procent(comparison.weightedNominalRate)} />
                  <Metric
                    label="Ränta + avgifter / år"
                    value={kr(comparison.currentAnnualInterest + comparison.currentAnnualFees)}
                  />
                  <Metric
                    label="Nuvarande plan"
                    value={comparison.baselineMonths ? `${comparison.baselineMonths} mån` : "–"}
                  />
                </div>
              </>
            ) : comparison.status === "ett" ? (
              <p className="mt-2 max-w-prose text-13 text-muted-foreground">
                Det finns inget att slå ihop. Om du någon gång får nya villkor ska de jämföras mot
                nuvarande totalkostnad och återbetalningstid, inte bara mot månadsbetalningen.
              </p>
            ) : (
              <p className="mt-2 max-w-prose text-13 text-muted-foreground">
                CSN och lån med säkerhet hålls utanför den här kontrollen. Uppdatera lånen när saldo,
                ränta eller avgifter ändras så att assistenten fortsätter använda rätt underlag.
              </p>
            )}

            <Link to="/lan" className="mt-4 inline-block text-13 underline underline-offset-4">
              Kontrollera låneuppgifterna
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="px-1">
          <h2 className="text-18">Fördjupa ett beslut</h2>
          <p className="mt-0.5 text-13 text-muted-foreground">
            Alla belopp och datum kommer från appens beräkningsmotorer. Modulerna hjälper dig förstå
            vad siffrorna betyder i vardagen.
          </p>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MODULES.map((m) => (
            <Link key={m.title} to={m.to} className="panel flex gap-3 p-3 hover:bg-accent/40">
              <m.icon className="mt-0.5 size-4 shrink-0 text-primary" />
              <div>
                <div className="text-sm font-medium">{m.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{m.text}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function AssistantCard({
  icon: Icon,
  eyebrow,
  title,
  text,
  to,
  link,
}: {
  icon: typeof Wallet;
  eyebrow: string;
  title: string;
  text: string;
  to: "/dashboard" | "/sparande" | "/plan";
  link: string;
}) {
  return (
    <article className="panel flex h-full flex-col p-4">
      <Icon className="size-4 text-primary" />
      <div className="label-xs mt-3">{eyebrow}</div>
      <div className="num mt-1 text-18">{title}</div>
      <p className="mt-2 flex-1 text-13 text-muted-foreground">{text}</p>
      <Link to={to} className="mt-4 text-13 underline underline-offset-4">
        {link}
      </Link>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[0.7rem] uppercase tracking-[0.05em] text-muted-foreground">{label}</div>
      <div className="num mt-1 text-13">{value}</div>
    </div>
  );
}
