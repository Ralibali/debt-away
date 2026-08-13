import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Loan } from "@/lib/payoff";
import type { UserParameters } from "@/lib/parameters";
import { allocateHumanBudget } from "@/lib/economic-assistant";
import { refinanceComparison } from "@/lib/refinance-comparison";
import { kr, procent } from "@/lib/format";

interface EconomicAssistantProps {
  loans: Loan[];
  monthlySurplus: number;
  bufferValue: number;
  bufferTarget: number;
  params?: UserParameters;
}

export function EconomicAssistant({
  loans,
  monthlySurplus,
  bufferValue,
  bufferTarget,
  params,
}: EconomicAssistantProps) {
  const [requiredImprovement, setRequiredImprovement] = useState(2);
  const allocation = useMemo(
    () => allocateHumanBudget(monthlySurplus, bufferValue, bufferTarget),
    [monthlySurplus, bufferValue, bufferTarget],
  );
  const comparison = useMemo(
    () => refinanceComparison(loans, requiredImprovement, params),
    [loans, requiredImprovement, params],
  );

  const bufferReady = bufferTarget <= 0 || bufferValue >= bufferTarget;
  const todayText =
    monthlySurplus <= 0
      ? "Behåll vardagskassan intakt. Ingen extraamortering behöver tas från pengar som redan behövs denna månad."
      : bufferReady
        ? `Planen lämnar ${kr(allocation.everyday)} till ett mänskligt vardagsutrymme samtidigt som ${kr(allocation.saving)} går till sparande och ${kr(allocation.extraDebt)} till extra amortering.`
        : `Bufferten är inte färdig ännu. Därför går mest av överskottet till sparande, men du behåller ändå ${kr(allocation.everyday)} till vardagen.`;

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border p-4 sm:p-5">
        <div className="label-xs">Din ekonomiska assistent</div>
        <h2 className="mt-1 text-20 font-medium">Vad ska nästa överskott göra?</h2>
        <p className="mt-2 max-w-2xl text-14 text-muted-foreground">{todayText}</p>
      </div>

      <div className="grid grid-cols-1 border-b border-border md:grid-cols-3">
        <div className="p-4 sm:p-5 md:border-r md:border-border">
          <div className="label-xs">Spara</div>
          <div className="num mt-2 text-24">{kr(allocation.saving)}</div>
          <p className="mt-1 text-13 text-muted-foreground">per månad av nuvarande överskott</p>
        </div>
        <div className="border-t border-border p-4 sm:p-5 md:border-r md:border-t-0 md:border-border">
          <div className="label-xs">Extra på lån</div>
          <div className="num mt-2 text-24">{kr(allocation.extraDebt)}</div>
          <p className="mt-1 text-13 text-muted-foreground">utöver planerade betalningar</p>
        </div>
        <div className="border-t border-border p-4 sm:p-5 md:border-t-0">
          <div className="label-xs">Pengar att leva för</div>
          <div className="num mt-2 text-24">{kr(allocation.everyday)}</div>
          <p className="mt-1 text-13 text-muted-foreground">
            cirka {kr(allocation.everydayPerDay)} per dag utan dåligt samvete
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="label-xs">Omläggningsradar</div>
            <h3 className="mt-1 text-18 font-medium">När är det värt att jämföra samlingslån?</h3>
            {comparison.loanCount > 0 ? (
              <p className="mt-2 text-14 text-muted-foreground">
                Du har {comparison.loanCount} osäkrade lån/krediter på totalt {kr(comparison.balance)}
                {" "}med viktad ränta {procent(comparison.weightedRate)}. Du väljer själv hur stor
                förbättring ett nytt erbjudande minst måste ge.
              </p>
            ) : (
              <p className="mt-2 text-14 text-muted-foreground">
                Inga osäkrade privatlån eller krediter finns att jämföra just nu.
              </p>
            )}
          </div>

          {comparison.loanCount > 0 && (
            <div className="w-full rounded-[6px] border border-border bg-background p-4 lg:max-w-sm">
              <label className="text-13 font-medium" htmlFor="improvement">
                Minsta förbättring: {requiredImprovement.toLocaleString("sv-SE")} procentenheter
              </label>
              <input
                id="improvement"
                className="mt-3 w-full accent-current"
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={requiredImprovement}
                onChange={(event) => setRequiredImprovement(Number(event.target.value))}
              />
              <div className="mt-3 border-t border-border pt-3">
                <div className="text-13 text-muted-foreground">Jämför erbjudanden under</div>
                <div className="num mt-1 text-24">{procent(comparison.comparisonCeiling)}</div>
                <div className="mt-1 text-12 text-muted-foreground">
                  Skillnaden motsvarar illustrativt cirka {kr(comparison.illustrativeMonthlyInterestDifference)}
                  {" "}i ränta per månad på dagens saldo, före nya avgifter och förändrad amortering.
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-[6px] border border-border bg-background p-3 text-12 text-muted-foreground">
          Omläggningsradarn är ett jämförelseverktyg, inte ett lånelöfte eller en rekommendation att ta mer kredit.
          Kontrollera alltid effektiv ränta, avgifter, total kostnad och återbetalningstid innan du ändrar ett lån.
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/plan" className="rounded-[6px] bg-signal px-3 py-2 text-13 font-medium text-primary-foreground">
            Optimera avbetalningen
          </Link>
          <Link to="/sparande" className="rounded-[6px] border border-border px-3 py-2 text-13 font-medium">
            Justera sparandet
          </Link>
          <Link to="/budgetplan" className="rounded-[6px] border border-border px-3 py-2 text-13 font-medium">
            Se månadsplanen
          </Link>
        </div>
      </div>
    </section>
  );
}
