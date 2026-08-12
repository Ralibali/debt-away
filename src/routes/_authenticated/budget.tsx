import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useBudgets, useCategories, useSaveBudget, useSaveCategory, useTransactions } from "@/lib/data";
import { summarize } from "@/lib/budget";
import { kr, manad, monthStartISO } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/budget")({
  head: () => ({
    meta: [
      { title: "Budget — Skuldfri" },
      {
        name: "description",
        content: "Planerat mot faktiskt per kategori och månad, med överskott för extraamortering.",
      },
      { property: "og:title", content: "Budget — Skuldfri" },
      {
        property: "og:description",
        content: "Planerat mot faktiskt per kategori och månad.",
      },
    ],
  }),
  component: BudgetPage,
});

function shiftMonth(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const n = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1));
  return n.toISOString().slice(0, 10);
}

function BudgetPage() {
  const [month, setMonth] = useState(monthStartISO());
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets(month);
  const { data: transactions = [] } = useTransactions(month, null);
  const saveBudget = useSaveBudget();
  const saveCategory = useSaveCategory();

  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"inkomst" | "utgift">("utgift");
  const [newFixed, setNewFixed] = useState(false);

  const s = summarize(categories, budgets, transactions);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h1 className="text-base font-semibold tracking-tight">Budget</h1>
        <div className="flex items-center gap-1 text-sm">
          <Button variant="ghost" size="sm" onClick={() => setMonth(shiftMonth(month, -1))}>
            ‹
          </Button>
          <span className="min-w-32 text-center capitalize">{manad(month)}</span>
          <Button variant="ghost" size="sm" onClick={() => setMonth(shiftMonth(month, 1))}>
            ›
          </Button>
        </div>
      </div>

      <div className="panel p-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="label-xs">Planerad inkomst</div>
            <div className="num font-medium">{kr(s.plannedIncome)}</div>
          </div>
          <div>
            <div className="label-xs">Planerad utgift</div>
            <div className="num font-medium">{kr(s.plannedExpense)}</div>
          </div>
          <div>
            <div className="label-xs">Faktisk inkomst</div>
            <div className="num font-medium">{kr(s.actualIncome)}</div>
          </div>
          <div>
            <div className="label-xs">Faktisk utgift</div>
            <div className="num font-medium">{kr(s.actualExpense)}</div>
          </div>
        </div>
        <div className="mt-3 rounded-md bg-primary/10 p-2.5">
          <div className="label-xs">Överskott tillgängligt för extraamortering</div>
          <div className="num text-xl font-semibold text-primary">{kr(s.plannedSurplus)}</div>
          <div className="num mt-0.5 text-xs text-muted-foreground">
            Faktiskt hittills: {kr(s.actualSurplus)}
          </div>
          <Link to="/plan" className="mt-2 inline-block text-xs font-medium text-primary">
            Använd i avbetalningsplanen →
          </Link>
        </div>
      </div>

      <BudgetVariance
        lines={s.lines
          .filter((l) => l.category.kind === "utgift")
          .map((l) => ({ name: l.category.name, planned: l.planned, actual: l.actual }))}
      />


      {(["inkomst", "utgift"] as const).map((kind) => {
        const lines = s.lines.filter((l) => l.category.kind === kind);
        if (lines.length === 0) return null;
        return (
          <div key={kind} className="panel overflow-hidden">
            <div className="label-xs px-3 pt-3">{kind === "inkomst" ? "Inkomster" : "Utgifter"}</div>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-1.5 font-medium">Kategori</th>
                  <th className="px-3 py-1.5 text-right font-medium">Planerat</th>
                  <th className="px-3 py-1.5 text-right font-medium">Faktiskt</th>
                  <th className="px-3 py-1.5 text-right font-medium">Diff</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.category.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-1.5">
                      {l.category.name}
                      {l.category.is_fixed && (
                        <span className="ml-1 text-[0.65rem] text-muted-foreground">fast</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Input
                        className="num h-8 w-24 text-right"
                        inputMode="decimal"
                        defaultValue={l.planned || ""}
                        onBlur={(e) => {
                          const planned = Number(e.target.value.replace(",", ".")) || 0;
                          if (planned === l.planned) return;
                          saveBudget.mutate({
                            category_id: l.category.id,
                            month,
                            planned,
                          });
                        }}
                      />
                    </td>
                    <td className="num px-3 py-1.5 text-right">{kr(l.actual)}</td>
                    <td
                      className={`num px-3 py-1.5 text-right ${
                        l.diff < 0 ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {kr(l.diff)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      <div className="panel space-y-2 p-3">
        <div className="label-xs">Ny kategori</div>
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-9 flex-1 min-w-40"
            placeholder="Namn"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={newKind}
            onChange={(e) => setNewKind(e.target.value as "inkomst" | "utgift")}
          >
            <option value="utgift">Utgift</option>
            <option value="inkomst">Inkomst</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={newFixed}
              onChange={(e) => setNewFixed(e.target.checked)}
            />
            Fast
          </label>
          <Button
            onClick={async () => {
              if (!newName.trim()) {
                toast.error("Ange ett namn");
                return;
              }
              await saveCategory.mutateAsync({
                name: newName.trim(),
                kind: newKind,
                is_fixed: newFixed,
              });
              setNewName("");
              toast.success("Kategori tillagd");
            }}
          >
            Lägg till
          </Button>
        </div>
      </div>
    </div>
  );
}
