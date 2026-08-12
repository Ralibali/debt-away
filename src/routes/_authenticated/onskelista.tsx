import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAddWish, useDecideWish, useDeleteWish, useWishlist, useParameters } from "@/lib/data";
import {
  DECISION_QUESTIONS,
  MOODS,
  cooldownLabel,
  daysLeft,
  decisionVerdict,
  extendCooldown,
  isCoolingDown,
  loggingDays,
  moodStats,
  savedTotal,
  type DecisionKey,
  type WishlistItem,
} from "@/lib/wishlist";
import { useCoach, useLatestInsight, type FrictionInsight, type Json } from "@/lib/coach";
import { datum, kr } from "@/lib/format";
import { CoachPanel } from "@/components/CoachPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/onskelista")({
  head: () => ({
    meta: [
      { title: "Impulsbroms — Skuldfri" },
      {
        name: "description",
        content:
          "Önskelista med kylperiod, humörlogg och beslutsblad som bromsar impulsköp innan de blir skuld.",
      },
      { property: "og:title", content: "Impulsbroms — Skuldfri" },
      {
        property: "og:description",
        content: "Kylperiod efter pris, humörlogg och fyra frågor innan köpet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WishlistPage,
});

function WishlistPage() {
  const { data: items = [] } = useWishlist();
  const { data: params } = useParameters();
  const add = useAddWish();
  const decide = useDecideWish();
  const del = useDeleteWish();

  const [item, setItem] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [mood, setMood] = useState<string>("behov");
  const [sheetFor, setSheetFor] = useState<string | null>(null);

  const stats = useMemo(() => moodStats(items), [items]);
  const days = loggingDays(items);
  const saved = savedTotal(items);
  const waiting = items.filter((i) => i.decision === "väntar");

  const cached = useLatestInsight<FrictionInsight>("friction");
  const coach = useCoach<FrictionInsight>("friction");
  const insight = coach.data ?? cached.data?.payload ?? null;

  const priceNumber = Number(price.replace(",", ".")) || 0;

  return (
    <div className="space-y-3">
      <div className="px-1">
        <h1 className="text-base font-semibold tracking-tight">Impulsbroms</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {waiting.length} väntar · {kr(saved)} avstått hittills
        </p>
      </div>

      <div className="panel space-y-2 p-3">
        <div className="label-xs">Lägg till på önskelistan</div>
        <Input
          className="h-9"
          placeholder="Vad är det?"
          value={item}
          onChange={(e) => setItem(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Input
            className="num h-9 w-28"
            inputMode="decimal"
            placeholder="Pris"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <Input
            className="h-9 flex-1 min-w-40"
            placeholder="Länk (valfritt)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          >
            {MOODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {priceNumber > 0 ? `Kylperiod: ${cooldownLabel(priceNumber, params)}` : "Kylperioden sätts av priset"}
          </span>
          <Button
            size="sm"
            onClick={async () => {
              if (!item.trim() || priceNumber <= 0) {
                toast.error("Ange vad det är och vad det kostar");
                return;
              }
              await add.mutateAsync({
                item: item.trim(),
                price: priceNumber,
                url: url.trim() || null,
                mood,
              });
              setItem("");
              setPrice("");
              setUrl("");
              toast.success("Tillagt — kylperioden har börjat");
            }}
          >
            Lägg till
          </Button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="label-xs px-3 pt-3">Önskelistan</div>
        <ul className="mt-2">
          {items.map((w) => (
            <WishRow
              key={w.id}
              w={w}
              open={sheetFor === w.id}
              onToggleSheet={() => setSheetFor(sheetFor === w.id ? null : w.id)}
              onDecide={(decision, cooldown) =>
                decide.mutate({ id: w.id, decision, ...(cooldown ? { cooldown_until: cooldown } : {}) })
              }
              onDelete={() => del.mutate(w.id)}
            />
          ))}
          {items.length === 0 && (
            <li className="px-3 pb-3 text-xs text-muted-foreground">
              Inget här ännu. Lägg in det du är sugen på i stället för att köpa direkt.
            </li>
          )}
        </ul>
      </div>

      <div className="panel p-3">
        <div className="label-xs">Humörmönster</div>
        {days < 30 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Statistiken visas efter 30 dagars loggning. {days} dagar hittills — inga poäng, inga
            märken, bara mönstret när det finns.
          </p>
        ) : (
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 font-medium">Humör</th>
                <th className="py-1.5 text-right font-medium">Avstått</th>
                <th className="py-1.5 text-right font-medium">Köpt</th>
                <th className="py-1.5 text-right font-medium">Sparat</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.mood} className="border-b border-border/60 last:border-0">
                  <td className="py-1.5">{s.mood}</td>
                  <td className="num py-1.5 text-right">
                    {s.avstatt} ({Math.round(s.restraintRate * 100)} %)
                  </td>
                  <td className="num py-1.5 text-right">{s.kopt}</td>
                  <td className="num py-1.5 text-right">{kr(s.savedAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CoachPanel
        title="Vad säger mönstret?"
        subtitle="Coachen läser statistiken ovan och sätter ord på den."
        hasResult={insight != null}
        pending={coach.isPending}
        error={coach.error}
        cachedAt={cached.data?.created_at ?? null}
        disabled={days < 30 || stats.length === 0}
        disabledReason="Behöver 30 dagars logg innan mönstret betyder något."
        onRun={(force) =>
          coach.mutate({
            input: { dagar_loggat: days, sparat_kronor: saved, humor: stats } as unknown as Json,
            force,
          })
        }
      >
        {insight && (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-muted-foreground">{insight.insight}</p>
            <ul className="space-y-0.5">
              {insight.tips.map((t, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  · {t}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CoachPanel>

      {saved > 0 && (
        <div className="panel p-3">
          <div className="label-xs">Pengarna du inte gjorde av med</div>
          <Link
            to="/plan"
            search={{ extra: Math.round(saved / 12) || 1 }}
            className="mt-1 block text-xs font-medium text-primary"
          >
            Testa {kr(saved)} i avbetalningsplanen →
          </Link>
        </div>
      )}
    </div>
  );
}

function WishRow({
  w,
  open,
  onToggleSheet,
  onDecide,
  onDelete,
}: {
  w: WishlistItem;
  open: boolean;
  onToggleSheet: () => void;
  onDecide: (decision: "köpt" | "avstått" | "väntar", cooldown?: string) => void;
  onDelete: () => void;
}) {
  const [answers, setAnswers] = useState<Partial<Record<DecisionKey, boolean>>>({});
  const cooling = isCoolingDown(w);
  const left = daysLeft(w);
  const v = decisionVerdict(answers);

  return (
    <li className="border-b border-border/60 px-3 py-2 last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-medium">{w.item}</span>
          {w.mood && (
            <span className="ml-1.5 rounded bg-accent px-1 text-[0.65rem] text-muted-foreground">
              {w.mood}
            </span>
          )}
          <div className="text-[0.7rem] text-muted-foreground">
            {w.decision === "väntar"
              ? cooling
                ? `Kylperiod till ${datum(w.cooldown_until)} — ${left} dagar kvar`
                : "Kylperioden är slut, dags att bestämma"
              : `${w.decision} ${w.decided_at ? datum(w.decided_at) : ""}`}
          </div>
        </div>
        <span className="num text-sm">{kr(w.price)}</span>
      </div>

      {w.decision === "väntar" && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={onToggleSheet}>
            {open ? "Stäng beslutsblad" : "Beslutsblad"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onDecide("avstått")}>
            Avstå
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDecide("väntar", extendCooldown(w))}
          >
            Förläng kylperioden
          </Button>
          <Button size="sm" disabled={cooling} onClick={() => onDecide("köpt")}>
            {cooling ? `Köp låst ${left} d` : "Jag köpte den"}
          </Button>
        </div>
      )}
      {w.decision !== "väntar" && (
        <button className="mt-1 text-[0.7rem] text-muted-foreground hover:text-destructive" onClick={onDelete}>
          Ta bort
        </button>
      )}

      {open && (
        <div className="mt-2 rounded-md bg-accent/50 p-2.5">
          {DECISION_QUESTIONS.map((q) => (
            <div key={q.key} className="flex items-center justify-between gap-2 py-1">
              <span className="text-xs">{q.text}</span>
              <div className="flex gap-1">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => setAnswers((a) => ({ ...a, [q.key]: val }))}
                    className={`rounded border px-2 py-0.5 text-[0.7rem] ${
                      answers[q.key] === val
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {val ? "Ja" : "Nej"}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-1.5 text-xs">
            {v.verdict == null ? (
              <span className="text-muted-foreground">
                {v.answered} av {DECISION_QUESTIONS.length} besvarade
              </span>
            ) : v.verdict === "avstått" ? (
              <span className="text-destructive">
                {v.noCount} nej — beslutsbladet säger avstå.
              </span>
            ) : (
              <span className="text-muted-foreground">
                {v.noCount} nej — köpet håller, men kylperioden gäller ändå.
              </span>
            )}
          </div>
          {v.verdict === "avstått" && (
            <Button size="sm" className="mt-1.5" onClick={() => onDecide("avstått")}>
              Markera som avstått
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
