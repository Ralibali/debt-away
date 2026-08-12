import { useMemo, useState } from "react";
import { toast } from "sonner";
import { compare, type Loan } from "@/lib/payoff";
import { kr, manad } from "@/lib/format";
import type { UserParameters } from "@/lib/parameters";
import {
  useScenarios,
  useSaveScenario,
  useUpdateScenario,
  useDeleteScenario,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Strategy3 = "avalanche" | "snowball" | "hybrid";

const STRATEGY_LABEL: Record<string, string> = {
  avalanche: "Lavin",
  snowball: "Snöboll",
  hybrid: "Hybrid",
};

export function ScenarioLibrary({
  loans,
  params,
  extra,
  strategy,
  onLoad,
}: {
  loans: Loan[];
  params: UserParameters | undefined;
  extra: number;
  strategy: Strategy3;
  onLoad: (extra: number, strategy: Strategy3) => void;
}) {
  const [name, setName] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const { data: scenarios = [] } = useScenarios();
  const save = useSaveScenario();
  const update = useUpdateScenario();
  const remove = useDeleteScenario();

  const outcomes = useMemo(() => {
    const now = new Date();
    const map = new Map<string, { debtFreeDate: string | null; totalInterest: number }>();
    for (const s of scenarios) {
      const res = compare(
        loans,
        Number(s.extra_per_month),
        (s.strategy as Strategy3) ?? "avalanche",
        now,
        params,
      );
      map.set(s.id, {
        debtFreeDate: res.chosen.debtFreeDate,
        totalInterest: res.chosen.totalInterest,
      });
    }
    return map;
  }, [scenarios, loans, params]);

  const best = useMemo(() => {
    let bestId: string | null = null;
    let bestInterest = Infinity;
    for (const [id, o] of outcomes) {
      if (o.debtFreeDate && o.totalInterest < bestInterest) {
        bestInterest = o.totalInterest;
        bestId = id;
      }
    }
    return bestId;
  }, [outcomes]);

  const dirty =
    loadedId != null &&
    (() => {
      const s = scenarios.find((x) => x.id === loadedId);
      return !!s && (Number(s.extra_per_month) !== extra || s.strategy !== strategy);
    })();

  return (
    <div className="panel space-y-3 p-3">
      <div className="flex items-baseline justify-between">
        <div className="label-xs">Scenarier</div>
        <div className="num text-[0.7rem] text-muted-foreground">
          {kr(extra)}/mån · {STRATEGY_LABEL[strategy]}
        </div>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Namn, t.ex. 'Extra 2000 lavin'"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          onClick={async () => {
            if (!name.trim()) {
              toast.error("Ange ett namn");
              return;
            }
            await save.mutateAsync({
              name: name.trim(),
              extra_per_month: extra,
              strategy,
            });
            setName("");
            toast.success("Scenario sparat");
          }}
        >
          Spara
        </Button>
      </div>

      {dirty && (
        <button
          className="text-xs text-muted-foreground underline underline-offset-2"
          onClick={async () => {
            await update.mutateAsync({ id: loadedId!, extra_per_month: extra, strategy });
            toast.success("Scenariot uppdaterat");
          }}
        >
          Uppdatera «{scenarios.find((s) => s.id === loadedId)?.name}» med nuvarande inställningar
        </button>
      )}

      {scenarios.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Inga sparade scenarier än. Ställ in extraamortering och strategi ovan och spara dem här
          för att kunna jämföra och ladda tillbaka dem senare.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {scenarios.map((s) => {
            const o = outcomes.get(s.id);
            const isLoaded = s.id === loadedId;
            return (
              <li
                key={s.id}
                className={`flex items-center justify-between gap-2 py-2 ${
                  isLoaded ? "-mx-3 bg-muted/40 px-3" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{s.name}</span>
                    {s.id === best && (
                      <span className="label-xs rounded border border-border px-1 py-px text-[0.6rem]">
                        billigast
                      </span>
                    )}
                  </div>
                  <div className="num text-[0.7rem] text-muted-foreground">
                    {kr(Number(s.extra_per_month))}/mån ·{" "}
                    {STRATEGY_LABEL[s.strategy] ?? s.strategy} ·{" "}
                    {o?.debtFreeDate
                      ? `skuldfri ${manad(o.debtFreeDate)} · ränta ${kr(o.totalInterest)}`
                      : "blir aldrig skuldfri"}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onLoad(Number(s.extra_per_month), (s.strategy as Strategy3) ?? "avalanche");
                      setLoadedId(s.id);
                      toast.success(`Laddade «${s.name}»`);
                    }}
                  >
                    Ladda
                  </Button>
                  <button
                    className="text-xs text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      await remove.mutateAsync(s.id);
                      if (isLoaded) setLoadedId(null);
                    }}
                  >
                    Ta bort
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
