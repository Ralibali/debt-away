import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useLoans, useParameters } from "@/lib/data";
import {
  compareConsolidationOffer,
  unsecuredConsumerLoans,
  type ConsolidationOffer,
} from "@/lib/refinance-lab";
import { effectiveRate } from "@/lib/payoff";
import { kr, procent } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/omlaggning")({
  head: () => ({
    meta: [
      { title: "Omläggningslabbet — Skuldfri" },
      {
        name: "description",
        content: "Jämför ett samlings- eller omläggningserbjudande mot nuvarande lån på samma villkor.",
      },
    ],
  }),
  component: Omlaggning,
});

function Diff({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted-foreground">–</span>;
  return <span className="num">{value > 0 ? "+" : ""}{kr(value)}</span>;
}

function Omlaggning() {
  const { data: loans = [] } = useLoans();
  const { data: params } = useParameters();
  const candidates = useMemo(() => unsecuredConsumerLoans(loans), [loans]);
  const [offer, setOffer] = useState<ConsolidationOffer>({
    nominalRate: 10,
    effectiveRate: null,
    termMonths: 84,
    monthlyFee: 0,
    setupFee: 0,
  });
  const comparison = useMemo(
    () => compareConsolidationOffer(loans, offer, params),
    [loans, offer, params],
  );

  const totalDirection =
    comparison.totalDifference == null
      ? "Nuvarande lån saknar en komplett slutpunkt i baslinjen, så totalbeloppen går inte att jämföra säkert ännu."
      : comparison.totalDifference < 0
        ? `Med de inmatade villkoren är erbjudandets beräknade totalbetalning ${kr(Math.abs(comparison.totalDifference))} lägre än nuvarande baslinje.`
        : comparison.totalDifference > 0
          ? `Med de inmatade villkoren är erbjudandets beräknade totalbetalning ${kr(comparison.totalDifference)} högre än nuvarande baslinje.`
          : "Med de inmatade villkoren blir totalbetalningen ungefär oförändrad.";

  return (
    <div className="space-y-8">
      <div>
        <div className="label-xs">Beslutsunderlag</div>
        <h1 className="mt-1 text-24">Omläggningslabbet</h1>
        <p className="mt-2 max-w-2xl text-13 text-muted-foreground">
          Mata in ett faktiskt erbjudande. Appen jämför månadskostnad, löptid och total betalning
          mot de osäkrade lån som redan finns registrerade. Den ansöker inte om kredit och bedömer
          inte om du blir godkänd.
        </p>
      </div>

      <section className="panel p-4">
        <div className="label-xs">Nuvarande underlag</div>
        {candidates.length === 0 ? (
          <p className="mt-2 text-13 text-muted-foreground">Inga osäkrade konsumtionslån finns registrerade.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="label-xs">Lån/krediter</div>
                <div className="num mt-1 text-18">{comparison.loanCount}</div>
              </div>
              <div>
                <div className="label-xs">Saldo</div>
                <div className="num mt-1 text-18">{kr(comparison.balance)}</div>
              </div>
              <div>
                <div className="label-xs">Viktad ränta</div>
                <div className="num mt-1 text-18">{procent(comparison.weightedCurrentRate)}</div>
              </div>
              <div>
                <div className="label-xs">Minimibetalningar</div>
                <div className="num mt-1 text-18">{kr(comparison.currentMonthlyMinimum)}/mån</div>
              </div>
            </div>
            <div className="mt-4 divide-y divide-border border-t border-border">
              {candidates.map((loan) => (
                <div key={loan.id} className="flex items-baseline justify-between gap-4 py-2 text-12">
                  <span className="truncate">{loan.name}</span>
                  <span className="num shrink-0 text-muted-foreground">
                    {kr(loan.current_balance)} · {procent(effectiveRate(loan, params))}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="panel p-4">
        <div className="label-xs">Erbjudandet</div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className="text-12">
            <span className="label-xs">Nominell ränta %</span>
            <input
              type="number"
              step="0.01"
              className="num mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-2"
              value={offer.nominalRate}
              onChange={(event) => setOffer({ ...offer, nominalRate: Number(event.target.value) })}
            />
          </label>
          <label className="text-12">
            <span className="label-xs">Effektiv ränta %</span>
            <input
              type="number"
              step="0.01"
              placeholder="valfritt"
              className="num mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-2"
              value={offer.effectiveRate ?? ""}
              onChange={(event) =>
                setOffer({
                  ...offer,
                  effectiveRate: event.target.value === "" ? null : Number(event.target.value),
                })
              }
            />
          </label>
          <label className="text-12">
            <span className="label-xs">Löptid månader</span>
            <input
              type="number"
              min="1"
              className="num mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-2"
              value={offer.termMonths}
              onChange={(event) => setOffer({ ...offer, termMonths: Number(event.target.value) })}
            />
          </label>
          <label className="text-12">
            <span className="label-xs">Månadsavgift</span>
            <input
              type="number"
              min="0"
              className="num mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-2"
              value={offer.monthlyFee}
              onChange={(event) => setOffer({ ...offer, monthlyFee: Number(event.target.value) })}
            />
          </label>
          <label className="text-12">
            <span className="label-xs">Startavgift</span>
            <input
              type="number"
              min="0"
              className="num mt-1 w-full rounded-[6px] border border-border bg-background px-2 py-2"
              value={offer.setupFee}
              onChange={(event) => setOffer({ ...offer, setupFee: Number(event.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-border p-4">
          <div className="label-xs">Jämförelse</div>
          <h2 className="mt-1 text-18">Samma skuld, två upplägg</h2>
        </div>
        <div className="grid grid-cols-3 border-b border-border text-12">
          <div className="p-3 text-muted-foreground">Mått</div>
          <div className="border-l border-border p-3 font-medium">Nuvarande</div>
          <div className="border-l border-border p-3 font-medium">Erbjudande</div>
        </div>
        <div className="grid grid-cols-3 border-b border-border text-13">
          <div className="p-3">Månadsbelopp</div>
          <div className="num border-l border-border p-3">{kr(comparison.currentMonthlyMinimum)}</div>
          <div className="num border-l border-border p-3">{kr(comparison.offerMonthlyPayment)}</div>
        </div>
        <div className="grid grid-cols-3 border-b border-border text-13">
          <div className="p-3">Löptid</div>
          <div className="num border-l border-border p-3">
            {comparison.currentMonths == null ? "–" : `${comparison.currentMonths} mån`}
          </div>
          <div className="num border-l border-border p-3">{offer.termMonths} mån</div>
        </div>
        <div className="grid grid-cols-3 border-b border-border text-13">
          <div className="p-3">Total betalning</div>
          <div className="num border-l border-border p-3">
            {comparison.currentTotalPaid == null ? "–" : kr(comparison.currentTotalPaid)}
          </div>
          <div className="num border-l border-border p-3">{kr(comparison.offerTotalPaid)}</div>
        </div>
        <div className="grid grid-cols-3 text-13">
          <div className="p-3">Skillnad totalt</div>
          <div className="border-l border-border p-3 text-muted-foreground">referens</div>
          <div className="border-l border-border p-3"><Diff value={comparison.totalDifference} /></div>
        </div>
        <div className="border-t border-border bg-background/40 p-4 text-13 text-muted-foreground">
          {totalDirection}
        </div>
      </section>

      <section className="panel p-4 text-12 text-muted-foreground">
        <div className="label-xs">Kontrollista innan du jämför</div>
        <p className="mt-2">
          Använd långivarens faktiska effektiva ränta, samtliga avgifter, exakt löptid och total
          kreditkostnad. En lägre månadsbetalning kan bero på längre återbetalningstid, därför visas
          både månad och total här.
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link to="/kontrollrum" className="rounded-[6px] border border-border px-3 py-2 text-13">
          Till kontrollrummet
        </Link>
        <Link to="/plan" className="rounded-[6px] bg-signal px-3 py-2 text-13 font-medium text-primary-foreground">
          Se befintliga skuldscenarier
        </Link>
      </div>
    </div>
  );
}
