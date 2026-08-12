/**
 * Datalager för tvåveckorsrytmen: vårdnadsschema, fasbudgetar, buffertposter,
 * intentioner, veckoavstämning och aviseringar.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Transaction } from "@/lib/data";
import type { PhaseBudget } from "@/lib/daily";
import type { Intention, IntentionEvent } from "@/lib/intentions";
import type { SinkingFund } from "@/lib/sinking";
import { DEFAULT_CARE_SCHEDULE, phaseFor, type CareSchedule, type Phase } from "@/lib/phase";
import type { NotificationKind } from "@/lib/notify";

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Inte inloggad");
  return data.user.id;
}

const num = (v: unknown) => (v == null ? 0 : Number(v));

// ------------------------------------------------------------ vårdnadsschema

export function useCareSchedule() {
  return useQuery({
    queryKey: ["care_schedule"],
    queryFn: async (): Promise<CareSchedule> => {
      const { data, error } = await supabase.from("care_schedule").select("*").maybeSingle();
      if (error) throw error;
      if (!data) return { ...DEFAULT_CARE_SCHEDULE };
      return {
        cycle_start: String(data.cycle_start).slice(0, 10),
        cycle_days: Number(data.cycle_days),
        child_days: Number(data.child_days),
        handover_weekday: Number(data.handover_weekday),
      };
    },
    initialData: { ...DEFAULT_CARE_SCHEDULE },
  });
}

export function useSaveCareSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: CareSchedule) => {
      const user_id = await uid();
      const { error } = await supabase
        .from("care_schedule")
        .upsert({ ...s, user_id } as never, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["care_schedule"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}

// -------------------------------------------------------------- fasbudgetar

export function usePhaseBudgets() {
  return useQuery({
    queryKey: ["phase_budgets"],
    queryFn: async (): Promise<PhaseBudget[]> => {
      const { data, error } = await supabase.from("phase_budgets").select("*");
      if (error) throw error;
      return (data ?? []).map((b) => ({
        id: b.id,
        category_id: b.category_id,
        phase: b.phase as Phase,
        planned: num(b.planned),
      }));
    },
  });
}

export function useSavePhaseBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { category_id: string; phase: Phase; planned: number }) => {
      const user_id = await uid();
      const { error } = await supabase
        .from("phase_budgets")
        .upsert({ ...b, user_id } as never, { onConflict: "user_id,category_id,phase" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["phase_budgets"] }),
  });
}

// ------------------------------------------------------------- buffertposter

export function useSinkingFunds() {
  return useQuery({
    queryKey: ["sinking_funds"],
    queryFn: async (): Promise<SinkingFund[]> => {
      const { data, error } = await supabase
        .from("sinking_funds")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        annual_estimate: num(f.annual_estimate),
        current_balance: num(f.current_balance),
        monthly_accrual: num(f.monthly_accrual),
        next_expected: f.next_expected ? String(f.next_expected).slice(0, 10) : null,
      }));
    },
  });
}

export function useSaveSinkingFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      f: { id?: string } & Partial<Omit<SinkingFund, "id" | "monthly_accrual">>,
    ) => {
      const user_id = await uid();
      const { id, ...input } = f;
      // Månadsavsättningen är alltid årsbeloppet delat på tolv — aldrig en gissning.
      const rest: Record<string, unknown> = { ...input };
      if (input.annual_estimate != null) {
        rest['monthly_accrual'] = Math.round((input.annual_estimate / 12) * 100) / 100;
      }
      if (id) {
        const { error } = await supabase
          .from("sinking_funds")
          .update(rest as never)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("sinking_funds")
          .insert({ ...rest, user_id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sinking_funds"] }),
  });
}

export function useDeleteSinkingFund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sinking_funds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sinking_funds"] }),
  });
}

// ---------------------------------------------------------------- intentioner

export function useIntentions() {
  return useQuery({
    queryKey: ["intentions"],
    queryFn: async (): Promise<Intention[]> => {
      const { data, error } = await supabase
        .from("intentions")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Intention[];
    },
  });
}

export function useSaveIntention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { id?: string } & Partial<Intention>) => {
      const user_id = await uid();
      const { id, ...rest } = i;
      if (id) {
        const { error } = await supabase.from("intentions").update(rest as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("intentions").insert({ ...rest, user_id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intentions"] }),
  });
}

export function useDeleteIntention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("intentions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intentions"] }),
  });
}

export function useIntentionEvents() {
  return useQuery({
    queryKey: ["intention_events"],
    queryFn: async (): Promise<IntentionEvent[]> => {
      const { data, error } = await supabase
        .from("intention_events")
        .select("*")
        .order("due_on", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as IntentionEvent[];
    },
  });
}

/** Markerar en intention som uppfylld. Ingen motsvarighet för missar. */
export function useFulfillIntention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { intention: Intention; due_on: string }) => {
      const user_id = await uid();
      const { error } = await supabase.from("intention_events").upsert(
        {
          user_id,
          intention_id: p.intention.id,
          due_on: p.due_on,
          fulfilled: true,
        } as never,
        { onConflict: "intention_id,due_on" },
      );
      if (error) throw error;
      const { error: e2 } = await supabase
        .from("intentions")
        .update({ fulfilled_count: p.intention.fulfilled_count + 1 } as never)
        .eq("id", p.intention.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intention_events"] });
      qc.invalidateQueries({ queryKey: ["intentions"] });
    },
  });
}

// ------------------------------------------------------------ veckoavstämning

export interface WeeklyReview {
  id: string;
  phase_start: string;
  phase: Phase;
  overspent_category_ids: string[];
  planned_next: { category_id: string; amount: number }[];
  created_at: string;
}

export function useWeeklyReviews() {
  return useQuery({
    queryKey: ["weekly_reviews"],
    queryFn: async (): Promise<WeeklyReview[]> => {
      const { data, error } = await supabase
        .from("weekly_reviews")
        .select("*")
        .order("phase_start", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        phase_start: String(r.phase_start).slice(0, 10),
        phase: r.phase as Phase,
        overspent_category_ids: (r.overspent_category_ids ?? []) as string[],
        planned_next: (r.planned_next ?? []) as { category_id: string; amount: number }[],
        created_at: r.created_at as string,
      }));
    },
  });
}

export function useSaveWeeklyReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: {
      phase_start: string;
      phase: Phase;
      overspent_category_ids: string[];
      planned_next: { category_id: string; amount: number }[];
    }) => {
      const user_id = await uid();
      const { error } = await supabase
        .from("weekly_reviews")
        .upsert({ ...r, user_id } as never, { onConflict: "user_id,phase_start" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly_reviews"] }),
  });
}

// ---------------------------------------------------------------- aviseringar

export interface NotificationRow {
  id: string;
  sent_on: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  read_at: string | null;
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notification_log"],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notification_log")
        .select("*")
        .order("sent_on", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((n) => ({
        id: n.id,
        sent_on: String(n.sent_on).slice(0, 10),
        kind: n.kind as NotificationKind,
        title: n.title,
        body: n.body,
        read_at: n.read_at,
      }));
    },
  });
}

export function useLogNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (n: { sent_on: string; kind: string; title: string; body: string }) => {
      const user_id = await uid();
      const { error } = await supabase
        .from("notification_log")
        .upsert({ ...n, user_id } as never, { onConflict: "user_id,sent_on" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification_log"] }),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notification_log")
        .update({ read_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification_log"] }),
  });
}

/** Pausknappen: ett tryck från aviseringen, inte begravd i inställningarna. */
export function usePauseNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (until: string) => {
      const user_id = await uid();
      const { error } = await supabase
        .from("user_parameters")
        .upsert({ user_id, notifications_paused_until: until } as never, {
          onConflict: "user_id",
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_parameters"] }),
  });
}

// ------------------------------------------------- transaktioner i ett spann

export function useTransactionsInRange(startISO: string, endISO: string) {
  return useQuery({
    queryKey: ["transactions", "range", startISO, endISO],
    queryFn: async (): Promise<Transaction[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("occurred_at", startISO)
        .lte("occurred_at", endISO)
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: num(t.amount) })) as Transaction[];
    },
  });
}

/** Sätter fasen på en enskild post och markerar den som överstyrd. */
export function useSetTransactionPhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; phase: Phase | null }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ phase: p.phase, phase_override: p.phase != null } as never)
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

/** Härleder fasen ur schemat — används vid manuell inmatning och import. */
export async function derivePhase(dateISO: string): Promise<Phase | null> {
  const { data } = await supabase.from("care_schedule").select("*").maybeSingle();
  if (!data) return null;
  return phaseFor(dateISO, {
    cycle_start: String(data.cycle_start).slice(0, 10),
    cycle_days: Number(data.cycle_days),
    child_days: Number(data.child_days),
    handover_weekday: Number(data.handover_weekday),
  });
}
