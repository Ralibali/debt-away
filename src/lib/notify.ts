/**
 * Notisbudget: högst en avisering per dag, aldrig efter 20:00, aldrig ett
 * negativt tal som rubrik. Pausknappen ligger på aviseringen, inte i
 * inställningarna.
 */

import { DEFAULT_PARAMETERS, type UserParameters } from "@/lib/parameters";
import type { DailyNumber } from "@/lib/daily";
import type { WishlistItem } from "@/lib/wishlist";
import { isHandoverDay, type CareSchedule } from "@/lib/phase";

export type NotificationKind =
  | "phase_start"
  | "payday"
  | "child_allowance"
  | "cooldown_over"
  | "weekly_review"
  | "milestone";

export interface Notification {
  kind: NotificationKind;
  title: string;
  body: string;
  /** Vart trycket leder */
  to?: string;
  /** Text på knappen */
  actionLabel?: string;
}

export interface NotifyInput {
  today: string;
  /** Timme 0–23 i lokal tid */
  hour: number;
  schedule: CareSchedule;
  daily: DailyNumber;
  wishlist: WishlistItem[];
  /** Lån som nått noll sedan förra gången */
  paidOffLoanName?: string | null;
  params?: UserParameters;
  /** Redan skickat idag */
  alreadySentToday: boolean;
}

const kr = (v: number) => `${Math.round(v).toLocaleString("sv-SE")} kr`;

export function isPaused(params: UserParameters, today: string): boolean {
  const until = params.notifications_paused_until;
  return until != null && until >= today;
}

/**
 * Väljer högst en avisering. Ordningen är prioritetsordningen: en milstolpe
 * går före allt annat, en kylperiod som gått ut före veckoavstämningen.
 */
export function pickNotification(input: NotifyInput): Notification | null {
  const p = input.params ?? DEFAULT_PARAMETERS;
  if (input.alreadySentToday) return null;
  if (isPaused(p, input.today)) return null;
  if (input.hour >= 20) return null;

  if (input.paidOffLoanName) {
    return {
      kind: "milestone",
      title: `${input.paidOffLoanName} är slutbetalt!`,
      body: "Hela lånet är borta. Nästa post i planen tar över beloppet.",
      to: "/plan",
      actionLabel: "Se planen",
    };
  }

  const day = Number(input.today.slice(8, 10));

  if (day === Math.round(p.payday)) {
    const extra = Math.abs(input.daily.parts.find((x) => x.label.includes("extra"))?.amount ?? 0);
    return {
      kind: "payday",
      title: "Lönedag",
      body:
        extra > 0
          ? `Planerat idag: flytta ${kr(extra)} till skulden.`
          : "Sätt beloppet som går till skulden idag.",
      to: "/lan",
      actionLabel: "Flytta nu",
    };
  }

  if (day === Math.round(p.child_allowance_day)) {
    const amount = p.child_allowance_total * p.child_allowance_share;
    return {
      kind: "child_allowance",
      title: "Barnbidrag",
      body: `${kr(amount)} kommer in idag. Det är inräknat i veckans siffra.`,
      to: "/rytm",
      actionLabel: "Se rytmen",
    };
  }

  const ripe = input.wishlist.filter(
    (w) => w.decision === "väntar" && w.cooldown_until <= input.today,
  );
  if (ripe.length > 0) {
    const w = ripe[0]!;
    return {
      kind: "cooldown_over",
      title: `Kylperioden på ${w.item} är slut`,
      body: `Du la till den för ${kr(w.price)}. Vill du fortfarande ha den?`,
      to: "/onskelista",
      actionLabel: "Köp, avstå eller förläng",
    };
  }

  if (isHandoverDay(input.today, input.schedule)) {
    if (input.hour < 12) {
      return {
        kind: "phase_start",
        title:
          input.daily.window.phase === "barnvecka" ? "Ny barnvecka" : "Ny ensamvecka",
        body: `Budget: ${kr(Math.max(0, input.daily.remaining))} — ${kr(
          Math.max(0, input.daily.perDay),
        )} per dag.`,
        to: "/dashboard",
        actionLabel: "Öppna",
      };
    }
    return {
      kind: "weekly_review",
      title: "Veckoavstämning",
      body: "Fem minuter, tre frågor.",
      to: "/avstamning",
      actionLabel: "Börja",
    };
  }

  return null;
}

export function pauseUntil(today: string, days = 7): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
