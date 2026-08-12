/**
 * Genomförandeintentioner: "när X, då Y". Appen kontrollerar bara om det hände.
 * En missad intention ger ingen notis — asymmetrin är avsiktlig.
 */

import { DEFAULT_PARAMETERS, type UserParameters } from "@/lib/parameters";
import { nextMonthDay, nextPhaseWindow, phaseWindow, type CareSchedule } from "@/lib/phase";

export type TriggerType = "payday" | "date" | "phase_start" | "transaction";

export interface Intention {
  id: string;
  trigger_text: string;
  action_text: string;
  trigger_type: TriggerType;
  trigger_config: { day?: number; phase?: string; pattern?: string } | null;
  active: boolean;
  fulfilled_count: number;
  missed_count: number;
}

export interface IntentionEvent {
  id: string;
  intention_id: string;
  due_on: string;
  fulfilled: boolean;
}

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  payday: "När lönen kommer",
  date: "En viss dag i månaden",
  phase_start: "När en ny fas börjar",
  transaction: "När ett visst köp dyker upp",
};

/** Nästa dag intentionen ska stämmas av. Null när den inte är datumstyrd. */
export function nextDue(
  i: Intention,
  todayISO: string,
  schedule: CareSchedule,
  params: UserParameters = DEFAULT_PARAMETERS,
): string | null {
  if (!i.active) return null;
  if (i.trigger_type === "payday") return nextMonthDay(todayISO, params.payday);
  if (i.trigger_type === "date") return nextMonthDay(todayISO, i.trigger_config?.day ?? 1);
  if (i.trigger_type === "phase_start") {
    const wanted = i.trigger_config?.phase;
    const current = phaseWindow(todayISO, schedule);
    if (current.dayIndex === 1 && (!wanted || wanted === current.phase)) return current.start;
    const next = nextPhaseWindow(todayISO, schedule);
    if (!wanted || wanted === next.phase) return next.start;
    return nextPhaseWindow(next.start, schedule).start;
  }
  return null;
}

export interface IntentionStatus {
  intention: Intention;
  due: string | null;
  /** Sant när avstämningen gäller idag */
  dueToday: boolean;
  event: IntentionEvent | null;
}

export function statuses(
  intentions: Intention[],
  events: IntentionEvent[],
  todayISO: string,
  schedule: CareSchedule,
  params: UserParameters = DEFAULT_PARAMETERS,
): IntentionStatus[] {
  return intentions.map((intention) => {
    const due = nextDue(intention, todayISO, schedule, params);
    const event =
      events.find((e) => e.intention_id === intention.id && e.due_on === due) ?? null;
    return { intention, due, dueToday: due === todayISO, event };
  });
}

/** Kort bekräftelse när något faktiskt gjordes. Aldrig text vid en miss. */
export function confirmation(i: Intention): string {
  return `${i.action_text} — gjort.`;
}
