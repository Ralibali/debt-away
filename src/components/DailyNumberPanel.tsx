import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { PHASE_LABELS } from "@/lib/phase";
import { nextPhaseNote, type DailyNumber } from "@/lib/daily";
import { CountUp } from "@/components/CountUp";
import { DailyCoachCard } from "@/components/DailyCoachCard";
import { MomentumCard } from "@/components/MomentumCard";
import { datum, kr } from "@/lib/format";

export function DailyNumberPanel({ daily }: { daily: DailyNumber }) {
  const [open, setOpen] = useState(false);
  const note = nextPhaseNote(daily);

  return (
    <>
      <section className="panel p-4">
        <div className="label-xs">
          Kvar att spendera den här {PHASE_LABELS[daily.window.phase].toLowerCase()}n
        </div>
        <div className="display mt-1 text-40 leading-none sm:text-64">
          <CountUp value={daily.remaining} format={(v) => kr(v)} />
        </div>
        <p className="mt-2 text-15 text-muted-foreground">
          {kr(daily.perDay)} per dag i {daily.daysLeft}{" "}
          {daily.daysLeft === 1 ? "dag kvar" : "dagar kvar"} · fasen slutar {datum(daily.window.end)}
        </p>

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-4 flex items-center gap-1 text-13 text-muted-foreground underline underline-offset-4"
          aria-expanded={open}
        >
          Så räknas siffran
          <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <ul className="mt-3 space-y-2 border-t border-border pt-3 text-13">
            <li className="flex items-baseline justify-between gap-4">
              <span>Saldo på lönekonto</span>
              <span className="num">{kr(daily.balance)}</span>
            </li>
            {daily.parts.map((p) => (
              <li key={p.label} className="flex items-baseline justify-between gap-4">
                <span className="text-muted-foreground">
                  {p.label}
                  {p.note && <span className="ml-1 text-[0.7rem]">({p.note})</span>}
                </span>
                <span className="num">{kr(p.amount)}</span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-4 border-t border-border pt-2 font-medium">
              <span>Kvar</span>
              <span className="num">{kr(daily.remaining)}</span>
            </li>
            <li className="pt-1 text-muted-foreground">Nästa lön {datum(daily.nextPayday)}.</li>
          </ul>
        )}

        {note && <p className="mt-4 border-t border-border pt-3 text-13 text-muted-foreground">{note}</p>}

        <div className="mt-4 border-t border-border pt-3">
          <Link to="/kontrollrum" className="text-13 font-medium underline underline-offset-4">
            Öppna ekonomiskt kontrollrum →
          </Link>
        </div>
      </section>

      <DailyCoachCard daily={daily} />
      <MomentumCard />
    </>
  );
}
