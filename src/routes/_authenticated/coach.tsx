import { createFileRoute, Link } from "@tanstack/react-router";
import { Droplets, ListChecks, HandCoins, ShoppingBag, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({
    meta: [
      { title: "Coach — Skuldfri" },
      {
        name: "description",
        content:
          "Fem coachmoduler: utgiftsläckor, skuldstrategi, budget utan skam, impulsbroms och köpbeslut.",
      },
      { property: "og:title", content: "Coach — Skuldfri" },
      {
        property: "og:description",
        content: "Utgiftsläckor, skuldstrategi, budget utan skam, impulsbroms och köpbeslut.",
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
    text: "Lavin, snöboll och hybrid räknat på dina lån — med förklaring av vilken som passar.",
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
  return (
    <div className="space-y-3">
      <div className="px-1">
        <h1 className="text-base font-semibold tracking-tight">Coach</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Appen räknar, coachen förklarar. Inget belopp, ingen ränta och inget datum kommer från
          en språkmodell.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
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
    </div>
  );
}
