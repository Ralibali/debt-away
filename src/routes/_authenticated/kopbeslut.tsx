import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useBudgets, useCategories, useLoans, useTransactions } from "@/lib/data";
import { summarize } from "@/lib/budget";
import { CREDIT_FACTS, computePurchase, type PaymentMethod } from "@/lib/purchase";
import { useCoach, useLatestInsight, type Json, type PurchaseVerdict } from "@/lib/coach";
import { kr, manad, monthStartISO } from "@/lib/format";
import { CoachPanel } from "@/components/CoachPanel";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/kopbeslut")({
  head: () => ({
    meta: [
      { title: "Köpbeslut — Skuldfri" },
      {
        name: "description",
        content:
          "Räkna ut vad ett köp faktiskt kostar: totalkostnad, effektiv ränta, timmar av lön och hur mycket det skjuter fram skuldfriheten.",
      },
      { property: "og:title", content: "Köpbeslut — Skuldfri" },
      {
        property: "og:description",
        content: "Totalkostnad, effektiv ränta och alternativkostnad innan du klickar köp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PurchasePage,
});

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "kontant", label: "Kontant" },
  { value: "kort", label: "Kort" },
  { value: "delbetalning", label: "Delbetalning" },
];

function PurchasePage() {
  const { data: loans = [] } = useLoans();
  const month = monthStartISO();
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: transactions = [] } = useTransactions(month, null);
  const surplus = Math.max(0, summarize(categories, budgets, transactions).plannedSurplus);

  const [what, setWhat] = useState("");
  const [price, setPrice] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("delbetalning");
  const [apr, setApr] = useState("0");
  const [months, setMonths] = useState("12");
  const [invoiceFee, setInvoiceFee] = useState("29");
  const [wage, setWage] = useState("150");

  const priceNumber = Number(price.replace(",", ".")) || 0;

  const calc = useMemo(
    () =>
      computePurchase(
        {
          what: what.trim() || "Köpet",
          price: priceNumber,
          method,
          apr: Number(apr.replace(",", ".")) || 0,
          months: Number(months) || 1,
          invoiceFee: Number(invoiceFee.replace(",", ".")) || 0,
          netHourlyWage: Number(wage.replace(",", ".")) || 0,
        },
        loans,
        surplus,
      ),
    [what, priceNumber, method, apr, months, invoiceFee, wage, loans, surplus],
  );

  const cached = useLatestInsight<PurchaseVerdict>("purchase");
  const coach = useCoach<PurchaseVerdict>("purchase");
  const verdict = coach.data ?? cached.data?.payload ?? null;

  const input = useMemo(
    () => ({
      vad: what.trim() || "Köpet",
      pris: calc.price,
      betalsatt: method,
      manader: calc.months,
      manadskostnad: calc.monthlyPayment,
      total_ranta: calc.totalInterest,
      totala_avgifter: calc.totalFees,
      totalkostnad: calc.totalCost,
      effektiv_ranta_procent: calc.effectiveApr,
      avgifternas_effektiva_ranta_procent: calc.feeEffectiveApr,
      timmar_av_nettolon: calc.hoursOfWork,
      alternativkostnad: {
        lan: calc.opportunity.loanName,
        manader_tidigare_skuldfri: calc.opportunity.monthsEarlier,
        rantebesparing: calc.opportunity.interestSaved,
        skuldfri_med_kop: calc.opportunity.debtFreeWith,
        skuldfri_utan_kop: calc.opportunity.debtFreeWithout,
      },
      red_flag: calc.redFlag,
      red_flag_orsak: calc.redFlagReason,
    }),
    [what, calc, method],
  );

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h1 className="text-base font-semibold tracking-tight">Köpbeslut</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Hela kalkylen körs i appen. Coachen får bara de färdiga talen.
        </p>
      </div>

      <div className="panel space-y-2 p-3">
        <Input
          className="h-9"
          placeholder="Vad vill du köpa?"
          value={what}
          onChange={(e) => setWhat(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Input
            className="num h-9 w-32"
            inputMode="decimal"
            placeholder="Pris"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <div className="flex gap-1">
            {METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMethod(m.value)}
                className={`rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  method === m.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {method === "delbetalning" && (
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[0.7rem] text-muted-foreground">
              Ränta %
              <Input
                className="num mt-0.5 h-8"
                inputMode="decimal"
                value={apr}
                onChange={(e) => setApr(e.target.value)}
              />
            </label>
            <label className="text-[0.7rem] text-muted-foreground">
              Månader
              <Input
                className="num mt-0.5 h-8"
                inputMode="numeric"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
              />
            </label>
            <label className="text-[0.7rem] text-muted-foreground">
              Aviavgift
              <Input
                className="num mt-0.5 h-8"
                inputMode="decimal"
                value={invoiceFee}
                onChange={(e) => setInvoiceFee(e.target.value)}
              />
            </label>
          </div>
        )}

        <label className="block text-[0.7rem] text-muted-foreground">
          Nettolön per timme
          <Input
            className="num mt-0.5 h-8 w-28"
            inputMode="decimal"
            value={wage}
            onChange={(e) => setWage(e.target.value)}
          />
        </label>
      </div>

      {priceNumber > 0 && (
        <>
          {calc.redFlag && (
            <div className="panel border-destructive/50 bg-destructive/10 p-3">
              <div className="text-sm font-semibold text-destructive">Röd flagga</div>
              <p className="mt-0.5 text-xs text-muted-foreground">{calc.redFlagReason}</p>
            </div>
          )}

          <div className="panel p-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="label-xs">Totalkostnad</div>
                <div className="num text-lg font-semibold">{kr(calc.totalCost)}</div>
              </div>
              <div>
                <div className="label-xs">Per månad</div>
                <div className="num text-lg font-semibold">{kr(calc.monthlyPayment)}</div>
              </div>
              <div>
                <div className="label-xs">Ränta + avgifter</div>
                <div className="num font-medium">{kr(calc.totalInterest + calc.totalFees)}</div>
              </div>
              <div>
                <div className="label-xs">Effektiv ränta</div>
                <div className="num font-medium">
                  {method === "delbetalning" ? `${calc.effektivText}` : "–"}
                </div>
              </div>
            </div>
            {calc.feeEffectiveApr > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Aviavgiften ensam motsvarar {calc.feeEffectiveApr} % effektiv ränta — en
                &quot;räntefri&quot; delbetalning är inte gratis.
              </p>
            )}
            {calc.hoursOfWork != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                Motsvarar {calc.hoursOfWork} timmar av din nettolön.
              </p>
            )}
          </div>

          <div className="panel p-3">
            <div className="label-xs">Alternativkostnad</div>
            {calc.opportunity.loanName == null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Du har inga lån att jämföra mot — pengarna konkurrerar bara med sparandet.
              </p>
            ) : (
              <div className="mt-1 space-y-1 text-xs">
                <p className="text-muted-foreground">
                  Samma {kr(calc.totalCost)} på {calc.opportunity.loanName} i stället:
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="label-xs">Skuldfri med köpet</div>
                    <div className="num font-medium">{manag(calc.opportunity.debtFreeWith)}</div>
                  </div>
                  <div>
                    <div className="label-xs">Skuldfri utan köpet</div>
                    <div className="num font-medium text-primary">
                      {manag(calc.opportunity.debtFreeWithout)}
                    </div>
                  </div>
                </div>
                {calc.opportunity.monthsEarlier != null && calc.opportunity.monthsEarlier > 0 && (
                  <p className="text-muted-foreground">
                    Köpet skjuter fram skuldfriheten {calc.opportunity.monthsEarlier} månader och
                    kostar {kr(calc.opportunity.interestSaved)} extra i ränta.
                  </p>
                )}
                <Link to="/plan" className="inline-block font-medium text-primary">
                  Se planen →
                </Link>
              </div>
            )}
          </div>

          <CoachPanel
            title="Coachens omdöme"
            subtitle="Tre meningar utifrån talen ovan — inga nya siffror."
            hasResult={verdict != null}
            pending={coach.isPending}
            error={coach.error}
            cachedAt={cached.data?.created_at ?? null}
            onRun={(force) => coach.mutate({ input: input as unknown as Json, force })}
          >
            {verdict && (
              <div className="space-y-1.5">
                <div
                  className={`text-sm font-semibold ${
                    verdict.verdict === "köp"
                      ? "text-primary"
                      : verdict.verdict === "vänta"
                        ? "text-foreground"
                        : "text-destructive"
                  }`}
                >
                  {verdict.verdict.toUpperCase()}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {verdict.motivering}
                </p>
                {verdict.alternativ && (
                  <p className="rounded-md bg-accent/60 p-2 text-xs">{verdict.alternativ}</p>
                )}
              </div>
            )}
          </CoachPanel>
        </>
      )}

      <div className="panel p-3">
        <div className="label-xs">Att känna till om krediter</div>
        <ul className="mt-1.5 space-y-1">
          {CREDIT_FACTS.map((f, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              · {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
