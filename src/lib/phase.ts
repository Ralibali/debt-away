/**
 * Tvåveckorsrytmen. Ren kod: cykeln räknas ut från ett startdatum, aldrig gissas.
 *
 * En cykel är `cycle_days` lång och inleds med `child_days` barndagar.
 * Allt räknas i UTC-datum utan tid, så en dag är alltid en dag.
 */

export type Phase = "barnvecka" | "ensamvecka";

export interface CareSchedule {
  /** Första dagen i en barnvecka, ISO-datum */
  cycle_start: string;
  cycle_days: number;
  child_days: number;
  /** 0 = söndag, 1 = måndag … 6 = lördag */
  handover_weekday: number;
}

export const DEFAULT_CARE_SCHEDULE: CareSchedule = {
  cycle_start: "2026-01-04",
  cycle_days: 14,
  child_days: 7,
  handover_weekday: 0,
};

export const PHASE_LABELS: Record<Phase, string> = {
  barnvecka: "Barnvecka",
  ensamvecka: "Ensamvecka",
};

export function toDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function daysBetween(fromISO: string, toISOStr: string): number {
  return Math.round((toDate(toISOStr).getTime() - toDate(fromISO).getTime()) / 86_400_000);
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** Position i cykeln, 0 … cycle_days − 1. */
export function cycleOffset(dateISO: string, s: CareSchedule): number {
  const len = Math.max(1, Math.round(s.cycle_days));
  return mod(daysBetween(s.cycle_start, dateISO), len);
}

export function phaseFor(dateISO: string, s: CareSchedule): Phase {
  const childDays = Math.min(Math.max(0, Math.round(s.child_days)), Math.round(s.cycle_days));
  return cycleOffset(dateISO, s) < childDays ? "barnvecka" : "ensamvecka";
}

export interface PhaseWindow {
  phase: Phase;
  /** Första dagen i fasen */
  start: string;
  /** Sista dagen i fasen, inklusive */
  end: string;
  /** Antal dagar fasen är lång */
  length: number;
  /** Dag nummer i fasen, 1-indexerad, för det datum som frågades */
  dayIndex: number;
  /** Dagar kvar inklusive dagen i fråga */
  daysLeft: number;
}

export function phaseWindow(dateISO: string, s: CareSchedule): PhaseWindow {
  const cycleDays = Math.max(1, Math.round(s.cycle_days));
  const childDays = Math.min(Math.max(0, Math.round(s.child_days)), cycleDays);
  const offset = cycleOffset(dateISO, s);
  const inChild = offset < childDays;
  const length = inChild ? childDays : cycleDays - childDays;
  const within = inChild ? offset : offset - childDays;
  const start = addDays(dateISO, -within);
  return {
    phase: inChild ? "barnvecka" : "ensamvecka",
    start,
    end: addDays(start, Math.max(0, length - 1)),
    length,
    dayIndex: within + 1,
    daysLeft: Math.max(1, length - within),
  };
}

export function nextPhaseWindow(dateISO: string, s: CareSchedule): PhaseWindow {
  const current = phaseWindow(dateISO, s);
  return phaseWindow(addDays(current.end, 1), s);
}

/** Föregående fas av samma slag — jämförelser görs fas mot fas. */
export function previousSamePhase(dateISO: string, s: CareSchedule): PhaseWindow {
  const current = phaseWindow(dateISO, s);
  const before = phaseWindow(addDays(current.start, -1), s);
  return phaseWindow(addDays(before.start, -1), s);
}

/** Överlämningsdagen är fasens första dag — den naturliga hållpunkten. */
export function isHandoverDay(dateISO: string, s: CareSchedule): boolean {
  return phaseWindow(dateISO, s).dayIndex === 1;
}

/** Nästa överlämning, ISO-datum. */
export function nextHandover(dateISO: string, s: CareSchedule): string {
  return nextPhaseWindow(dateISO, s).start;
}

export function inWindow(dateISO: string, w: { start: string; end: string }): boolean {
  const d = dateISO.slice(0, 10);
  return d >= w.start && d <= w.end;
}

/** Nästa förekomst av en månadsdag, t.ex. lönedagen den 25:e. */
export function nextMonthDay(dateISO: string, day: number, includeToday = true): string {
  const d = toDate(dateISO);
  const target = Math.min(Math.max(1, Math.round(day)), 28);
  const thisMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), target));
  if (includeToday ? toISO(thisMonth) >= dateISO : toISO(thisMonth) > dateISO) {
    return toISO(thisMonth);
  }
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, target)));
}

export function daysInMonth(dateISO: string): number {
  const d = toDate(dateISO);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}
