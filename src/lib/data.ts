import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Loan } from "@/lib/payoff";

export interface Account {
  id: string;
  name: string;
  kind: string;
  balance: number;
}

export interface Category {
  id: string;
  name: string;
  kind: "inkomst" | "utgift";
  is_fixed: boolean;
}

export interface Transaction {
  id: string;
  account_id: string | null;
  category_id: string | null;
  occurred_at: string;
  amount: number;
  description: string | null;
  is_recurring: boolean;
}

export interface Budget {
  id: string;
  category_id: string;
  month: string;
  planned: number;
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Inte inloggad");
  return data.user.id;
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

export function useLoans() {
  return useQuery({
    queryKey: ["loans"],
    queryFn: async (): Promise<Loan[]> => {
      const { data, error } = await supabase
        .from("loans")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((l) => ({
        ...l,
        current_balance: num(l.current_balance),
        original_amount: l.original_amount == null ? null : Number(l.original_amount),
        credit_limit: l.credit_limit == null ? null : Number(l.credit_limit),
        nominal_rate: num(l.nominal_rate),
        min_payment: l.min_payment == null ? null : Number(l.min_payment),
        min_payment_pct: l.min_payment_pct == null ? null : Number(l.min_payment_pct),
        monthly_fee: l.monthly_fee == null ? null : Number(l.monthly_fee),
      })) as Loan[];
    },
  });
}

export function useSaveLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (loan: Partial<Loan> & { id?: string }) => {
      const user_id = await uid();
      const payload = { ...loan, user_id } as never;
      if (loan.id) {
        const { error } = await supabase.from("loans").update(payload).eq("id", loan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("loans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  });
}

export function useDeleteLoan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase.from("categories").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });
}

export function useSaveCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: { name: string; kind: string; is_fixed: boolean }) => {
      const user_id = await uid();
      const { error } = await supabase.from("categories").insert({ ...c, user_id } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async (): Promise<Account[]> => {
      const { data, error } = await supabase.from("accounts").select("*").order("name");
      if (error) throw error;
      return (data ?? []).map((a) => ({ ...a, balance: num(a.balance) })) as Account[];
    },
  });
}

export function useTransactions(month: string | null, categoryId: string | null) {
  return useQuery({
    queryKey: ["transactions", month, categoryId],
    queryFn: async (): Promise<Transaction[]> => {
      let q = supabase.from("transactions").select("*").order("occurred_at", { ascending: false });
      if (month) {
        const start = month;
        const d = new Date(`${month}T00:00:00Z`);
        const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
          .toISOString()
          .slice(0, 10);
        q = q.gte("occurred_at", start).lt("occurred_at", end);
      }
      if (categoryId) q = q.eq("category_id", categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((t) => ({ ...t, amount: num(t.amount) })) as Transaction[];
    },
  });
}

export function useSaveTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Omit<Transaction, "id">) => {
      const user_id = await uid();
      const { error } = await supabase.from("transactions").insert({ ...t, user_id } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: async (): Promise<Budget[]> => {
      const { data, error } = await supabase.from("budgets").select("*").eq("month", month);
      if (error) throw error;
      return (data ?? []).map((b) => ({ ...b, planned: num(b.planned) })) as Budget[];
    },
  });
}

export function useSaveBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { category_id: string; month: string; planned: number }) => {
      const user_id = await uid();
      const { error } = await supabase
        .from("budgets")
        .upsert({ ...b, user_id } as never, { onConflict: "user_id,category_id,month" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budgets"] }),
  });
}

export function useScenarios() {
  return useQuery({
    queryKey: ["scenarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scenarios")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((s) => ({ ...s, extra_per_month: num(s.extra_per_month) }));
    },
  });
}

export function useSaveScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: { name: string; extra_per_month: number; strategy: string }) => {
      const user_id = await uid();
      const { error } = await supabase.from("scenarios").insert({ ...s, user_id } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenarios"] }),
  });
}

export function useDeleteScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scenarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scenarios"] }),
  });
}
