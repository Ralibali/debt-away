import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CommitmentKind =
  | "housing"
  | "leasing"
  | "insurance"
  | "utilities"
  | "telecom"
  | "subscription"
  | "transport"
  | "other";

export const COMMITMENT_KIND_LABELS: Record<CommitmentKind, string> = {
  housing: "Boende",
  leasing: "Leasing",
  insurance: "Försäkring",
  utilities: "El & drift",
  telecom: "Telekom",
  subscription: "Prenumeration",
  transport: "Transport",
  other: "Övrigt",
};

export interface FinancialCommitment {
  id: string;
  category_id: string | null;
  name: string;
  kind: CommitmentKind;
  monthly_amount: number;
  payment_day: number | null;
  starts_on: string | null;
  ends_on: string | null;
  notice_days: number | null;
  is_essential: boolean;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type FinancialCommitmentInput = Omit<FinancialCommitment, "id" | "created_at" | "updated_at">;

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Inte inloggad");
  return data.user.id;
}

const num = (value: unknown) => (value == null ? 0 : Number(value));
const commitmentTable = () => supabase.from("financial_commitments" as never);

export function useFinancialCommitments() {
  return useQuery({
    queryKey: ["financial_commitments"],
    queryFn: async (): Promise<FinancialCommitment[]> => {
      const { data, error } = await commitmentTable().select("*");
      if (error) throw error;
      return ((data ?? []) as unknown as FinancialCommitment[])
        .map((row) => ({
          ...row,
          monthly_amount: num(row.monthly_amount),
          payment_day: row.payment_day == null ? null : Number(row.payment_day),
          notice_days: row.notice_days == null ? null : Number(row.notice_days),
          starts_on: row.starts_on ? String(row.starts_on).slice(0, 10) : null,
          ends_on: row.ends_on ? String(row.ends_on).slice(0, 10) : null,
        }))
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "sv"));
    },
  });
}

export function useSaveFinancialCommitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<FinancialCommitmentInput> & { id?: string; name: string }) => {
      const user_id = await uid();
      const { id, ...rest } = input;
      const payload = {
        ...rest,
        monthly_amount: Math.max(0, Number(rest.monthly_amount ?? 0)),
        payment_day: rest.payment_day || null,
        notice_days: rest.notice_days == null ? null : Math.max(0, Number(rest.notice_days)),
        starts_on: rest.starts_on || null,
        ends_on: rest.ends_on || null,
        category_id: rest.category_id || null,
        notes: rest.notes || null,
      };
      if (id) {
        const { error } = await commitmentTable().update(payload as never).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await commitmentTable().insert({ ...payload, user_id } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financial_commitments"] }),
  });
}

export function useDeleteFinancialCommitment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await commitmentTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["financial_commitments"] }),
  });
}

export function isCommitmentActiveOn(commitment: FinancialCommitment, dateISO: string): boolean {
  if (!commitment.active) return false;
  if (commitment.starts_on && dateISO < commitment.starts_on) return false;
  if (commitment.ends_on && dateISO > commitment.ends_on) return false;
  return true;
}

export function activeCommitments(
  commitments: FinancialCommitment[],
  dateISO: string,
): FinancialCommitment[] {
  return commitments.filter((commitment) => isCommitmentActiveOn(commitment, dateISO));
}

export function monthlyCommitmentTotal(commitments: FinancialCommitment[], dateISO: string): number {
  return activeCommitments(commitments, dateISO).reduce(
    (sum, commitment) => sum + commitment.monthly_amount,
    0,
  );
}

export function essentialCommitmentTotal(commitments: FinancialCommitment[], dateISO: string): number {
  return activeCommitments(commitments, dateISO)
    .filter((commitment) => commitment.is_essential)
    .reduce((sum, commitment) => sum + commitment.monthly_amount, 0);
}

export interface CommitmentRelease {
  date: string;
  amount: number;
  names: string[];
}

export function commitmentReleases(
  commitments: FinancialCommitment[],
  fromISO: string,
): CommitmentRelease[] {
  const byDate = new Map<string, { amount: number; names: string[] }>();
  for (const commitment of commitments) {
    if (!commitment.active || !commitment.ends_on || commitment.ends_on < fromISO) continue;
    const existing = byDate.get(commitment.ends_on) ?? { amount: 0, names: [] };
    existing.amount += commitment.monthly_amount;
    existing.names.push(commitment.name);
    byDate.set(commitment.ends_on, existing);
  }
  return [...byDate.entries()]
    .map(([date, value]) => ({ date, amount: value.amount, names: value.names }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
