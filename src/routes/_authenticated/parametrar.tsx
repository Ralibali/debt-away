import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useParameterChanges,
  useParameters,
  useSaveParameters,
} from "@/lib/data";
import {
  DEFAULT_PARAMETERS,
  PARAM_FIELDS,
  PARAM_GROUP_LABELS,
  inputToParam,
  paramToInput,
  type ParamField,
  type UserParameters,
} from "@/lib/parameters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/parametrar")({
  head: () => ({
    meta: [
      { title: "Parametrar — Skuldfri" },
      {
        name: "description",
        content:
          "Ställ in skattesatser, ränteavdrag, buffertmål och kylperioder som styr alla beräkningar.",
      },
      { property: "og:title", content: "Parametrar — Skuldfri" },
      {
        property: "og:description",
        content: "Alla konstanter i beräkningarna på ett ställe, med ändringslogg.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParametersPage,
});

const GROUPS: ParamField["group"][] = ["skatt", "ekonomi", "beteende"];

function suffix(f: ParamField): string {
  if (f.kind === "percent") return "%";
  if (f.kind === "amount") return "kr";
  if (f.kind === "hours") return "h";
  return "";
}

function ParametersPage() {
  const { data: saved = DEFAULT_PARAMETERS } = useParameters();
  const { data: changes = [] } = useParameterChanges();
  const save = useSaveParameters();
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of PARAM_FIELDS) next[f.key] = paramToInput(saved, f);
    setDraft(next);
  }, [saved]);

  const dirty = useMemo(
    () => PARAM_FIELDS.some((f) => (draft[f.key] ?? "") !== paramToInput(saved, f)),
    [draft, saved],
  );

  const fieldLabel = (key: string) => PARAM_FIELDS.find((f) => f.key === key)?.label ?? key;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: UserParameters = { ...saved };
    for (const f of PARAM_FIELDS) {
      const parsed = inputToParam(draft[f.key] ?? "", f);
      if (parsed == null && !f.optional) {
        toast.error(`${f.label} måste ha ett värde`);
        return;
      }
      next[f.key] = parsed as never;
    }
    const count = await save.mutateAsync({ next, previous: saved });
    toast.success(count === 0 ? "Inget ändrat" : `${count} parameter${count === 1 ? "" : "rar"} sparade`);
  }

  function reset() {
    const next: Record<string, string> = {};
    for (const f of PARAM_FIELDS) next[f.key] = paramToInput(DEFAULT_PARAMETERS, f);
    setDraft(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h1 className="text-base font-semibold tracking-tight">Parametrar</h1>
        <span className="num text-[0.7rem] text-muted-foreground">
          {saved.updated_at ? `Sparade ${saved.updated_at.slice(0, 10)}` : "Standardvärden 2026"}
        </span>
      </div>
      <p className="px-1 text-13 text-muted-foreground">
        Varje konstant i beräkningarna finns här. Ingen siffra i appen är gissad — ändrar du ett
        värde räknas allt om med det nya.
      </p>

      <form onSubmit={submit} className="space-y-3">
        {GROUPS.map((group) => (
          <section key={group} className="panel">
            <h2 className="border-b border-border px-3 py-2 text-13 font-semibold">
              {PARAM_GROUP_LABELS[group]}
            </h2>
            <div className="divide-y divide-border/60">
              {PARAM_FIELDS.filter((f) => f.group === group).map((f) => (
                <div key={f.key} className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <label htmlFor={f.key} className="block text-13">
                      {f.label}
                      {f.optional && (
                        <span className="text-muted-foreground"> · valfri</span>
                      )}
                    </label>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {f.usedBy}
                      {f.hint ? ` · ${f.hint}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      id={f.key}
                      inputMode="decimal"
                      className="num h-8 text-right"
                      value={draft[f.key] ?? ""}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                    />
                    <span className="w-4 text-[0.7rem] text-muted-foreground">{suffix(f)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="flex items-center gap-2 px-1">
          <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
            Spara
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={reset}>
            Återställ standard 2026
          </Button>
        </div>
      </form>

      <section className="panel">
        <h2 className="border-b border-border px-3 py-2 text-13 font-semibold">Ändringslogg</h2>
        {changes.length === 0 ? (
          <p className="p-3 text-13 text-muted-foreground">Inga ändringar ännu.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {changes.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-13">
                <span className="min-w-0 flex-1 truncate">{fieldLabel(c.field)}</span>
                <span className="num text-[0.7rem] text-muted-foreground">
                  {c.old_value ?? "–"} → {c.new_value ?? "–"}
                </span>
                <span className="num text-[0.7rem] text-muted-foreground">
                  {c.changed_at.slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
