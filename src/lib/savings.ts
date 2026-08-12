/**
 * Sparande och avstämningar. Manuell inmatning — inga mäklar-API:er,
 * inga innehav, inga kurser. En totalsiffra per konto och månad.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SavingsKind = "isk" | "kf" | "af" | "sparkonto" | "pension" | "buffert";

export const SAVINGS_KIND_LABELS: Record<SavingsKind, string> = {
  isk: "ISK",
  kf: "Kapitalförsäkring",
  af: "Aktie- & fondkonto",
  sparkonto: "Sparkonto",
  pension: "Pension",
  buffert: "Buffert",
};

/** Konton som omfattas av schablonskatt och delar fribeloppet. */
export const SCHABLON_KINDS: SavingsKind[] = ["isk", "kf"];

export interface SavingsAccount {
  id: string;
  name: string;
  provider: string | null;
  kind: SavingsKind;
  current_value: number;
  target_value: number | null;
  interest_rate: number | null;
  is_buffer: boolean;
  created_at: string | null;
}

export interface SavingsSnapshot {
  id: string;
  account_id: string;
  snapshot_date: string;
  value: number;
  deposits_since_last: number;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Inte inloggad");
  return data.user.id;
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

export function useSavingsAccounts() {
  return useQuery({
    queryKey: ["savings_accounts"],
    queryFn: async (): Promise<SavingsAccount[]> => {
      const { data, error } = await supabase
        .from("savings_accounts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((a) => ({
        ...a,
        current_value: num(a.current_value),
        target_value: a.target_value == null ? null : Number(a.target_value),
        interest_rate: a.interest_rate == null ? null : Number(a.interest_rate),
      })) as SavingsAccount[];
    },
  });
}

export function useSaveSavingsAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<SavingsAccount> & { id?: string }) => {
      const user_id = await uid();
      const payload = { ...a, user_id } as never;
      if (a.id) {
        const { error } = await supabase.from("savings_accounts").update(payload).eq("id", a.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("savings_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings_accounts"] });
      qc.invalidateQueries({ queryKey: ["savings_snapshots"] });
    },
  });
}

export function useDeleteSavingsAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("savings_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings_accounts"] });
      qc.invalidateQueries({ queryKey: ["savings_snapshots"] });
    },
  });
}

export function useSavingsSnapshots() {
  return useQuery({
    queryKey: ["savings_snapshots"],
    queryFn: async (): Promise<SavingsSnapshot[]> => {
      const { data, error } = await supabase
        .from("savings_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((s) => ({
        id: s.id,
        account_id: s.account_id,
        snapshot_date: s.snapshot_date,
        value: num(s.value),
        deposits_since_last: num(s.deposits_since_last),
      }));
    },
  });
}

export interface SnapshotInput {
  account_id: string;
  snapshot_date: string;
  value: number;
  deposits_since_last: number;
}

/** Avstämning: skriver en rad per konto och uppdaterar kontots aktuella värde. */
export function useSaveSnapshots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: SnapshotInput[]) => {
      if (rows.length === 0) return;
      const user_id = await uid();
      const { error } = await supabase
        .from("savings_snapshots")
        .upsert(rows.map((r) => ({ ...r, user_id })) as never, {
          onConflict: "user_id,account_id,snapshot_date",
        });
      if (error) throw error;
      for (const r of rows) {
        const { error: e2 } = await supabase
          .from("savings_accounts")
          .update({ current_value: r.value } as never)
          .eq("id", r.account_id);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["savings_accounts"] });
      qc.invalidateQueries({ queryKey: ["savings_snapshots"] });
    },
  });
}

/** Senaste kända värdet per konto på eller före ett datum. */
export function valueOn(
  snapshots: SavingsSnapshot[],
  accountId: string,
  dateISO: string,
): number | null {
  const rows = snapshots
    .filter((s) => s.account_id === accountId && s.snapshot_date <= dateISO)
    .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const last = rows[rows.length - 1];
  return last ? last.value : null;
}

/** Insättningar under ett kalenderår för en uppsättning konton. */
export function depositsInYear(
  snapshots: SavingsSnapshot[],
  accountIds: string[],
  year: number,
): number {
  return snapshots
    .filter(
      (s) =>
        accountIds.includes(s.account_id) && s.snapshot_date.startsWith(String(year)),
    )
    .reduce((sum, s) => sum + s.deposits_since_last, 0);
}

/** Genomsnittlig insättning per månad de senaste `months` månaderna. */
export function averageMonthlyDeposits(snapshots: SavingsSnapshot[], months = 6): number {
  if (snapshots.length === 0) return 0;
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const iso = cutoff.toISOString().slice(0, 10);
  const recent = snapshots.filter((s) => s.snapshot_date >= iso);
  if (recent.length === 0) return 0;
  const total = recent.reduce((sum, s) => sum + s.deposits_since_last, 0);
  const uniqueMonths = new Set(recent.map((s) => s.snapshot_date.slice(0, 7))).size;
  return uniqueMonths > 0 ? total / uniqueMonths : 0;
}

/** Är det dags för månadens avstämning? */
export function needsReconciliation(
  snapshots: SavingsSnapshot[],
  accounts: SavingsAccount[],
  today: Date = new Date(),
): boolean {
  if (accounts.length === 0) return false;
  const monthKey = today.toISOString().slice(0, 7);
  const done = new Set(
    snapshots.filter((s) => s.snapshot_date.startsWith(monthKey)).map((s) => s.account_id),
  );
  return accounts.some((a) => !done.has(a.id));
}
