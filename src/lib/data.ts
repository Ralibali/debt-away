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
  /** 'manual' eller 'import' */
  source?: string;
  raw_description?: string | null;
  booking_date?: string | null;
  import_hash?: string | null;
  /** Låst rad: importerad och avstämd, får inte ändras av misstag */
  is_locked?: boolean;
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

// ---------------------------------------------------------------- önskelista

import { cooldownUntil, type Decision, type WishlistItem } from "@/lib/wishlist";

export function useWishlist() {
  return useQuery({
    queryKey: ["wishlist"],
    queryFn: async (): Promise<WishlistItem[]> => {
      const { data, error } = await supabase
        .from("wishlist")
        .select("*")
        .order("added_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((w) => ({ ...w, price: num(w.price) })) as WishlistItem[];
    },
  });
}

export function useAddWish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (w: { item: string; price: number; url: string | null; mood: string | null }) => {
      const user_id = await uid();
      const { error } = await supabase.from("wishlist").insert({
        ...w,
        user_id,
        cooldown_until: cooldownUntil(w.price),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });
}

export function useDecideWish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; decision: Decision; cooldown_until?: string }) => {
      const patch: Record<string, unknown> = { decision: p.decision };
      if (p.cooldown_until) patch["cooldown_until"] = p.cooldown_until;
      const { error } = await supabase.from("wishlist").update(patch as never).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });
}

export function useDeleteWish() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wishlist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wishlist"] }),
  });
}

// ------------------------------------------------------------ lånebetalningar

export interface LoanPayment {
  id: string;
  loan_id: string;
  paid_at: string;
  amount: number;
  interest_part: number | null;
  principal_part: number | null;
  is_extra: boolean;
}

export function useLoanPayments(monthStart: string) {
  return useQuery({
    queryKey: ["loan_payments", monthStart],
    queryFn: async (): Promise<LoanPayment[]> => {
      const d = new Date(`${monthStart}T00:00:00Z`);
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
        .toISOString()
        .slice(0, 10);
      const { data, error } = await supabase
        .from("loan_payments")
        .select("*")
        .gte("paid_at", monthStart)
        .lt("paid_at", end)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({ ...p, amount: num(p.amount) })) as LoanPayment[];
    },
  });
}

/**
 * Registrera en betalning. Ränte- och amorteringsdel räknas ut i kod
 * (payoff.monthlyInterest) och saldot skrivs ned med amorteringsdelen.
 */
export function useRegisterPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      loan: Loan;
      amount: number;
      paid_at: string;
      is_extra: boolean;
      interest_part: number;
    }) => {
      const user_id = await uid();
      const principal = Math.max(0, p.amount - p.interest_part);
      const { error } = await supabase.from("loan_payments").insert({
        user_id,
        loan_id: p.loan.id,
        paid_at: p.paid_at,
        amount: p.amount,
        interest_part: p.interest_part,
        principal_part: principal,
        is_extra: p.is_extra,
      } as never);
      if (error) throw error;
      const newBalance = Math.max(0, p.loan.current_balance + p.interest_part - p.amount);
      const { error: e2 } = await supabase
        .from("loans")
        .update({ current_balance: newBalance } as never)
        .eq("id", p.loan.id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loan_payments"] });
      qc.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

/** Alla registrerade betalningar — används för historiken i korspunkten. */
export function useAllLoanPayments() {
  return useQuery({
    queryKey: ["loan_payments", "all"],
    queryFn: async (): Promise<LoanPayment[]> => {
      const { data, error } = await supabase
        .from("loan_payments")
        .select("*")
        .order("paid_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        amount: num(p.amount),
        interest_part: p.interest_part == null ? null : Number(p.interest_part),
        principal_part: p.principal_part == null ? null : Number(p.principal_part),
      })) as LoanPayment[];
    },
  });
}

/** Amorterat belopp per månad (YYYY-MM-01 → kronor). */
export function principalByMonth(payments: LoanPayment[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of payments) {
    const key = `${p.paid_at.slice(0, 7)}-01`;
    out[key] = (out[key] ?? 0) + (p.principal_part ?? 0);
  }
  return out;
}

/** Uppdatera en befintlig transaktion (kategori, lås, beskrivning). */
export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { id: string } & Partial<Omit<Transaction, "id">>) => {
      const { id, ...rest } = t;
      const { error } = await supabase.from("transactions").update(rest as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });
}

// ---------------------------------------------------------------------------
// Manuella parametrar
// ---------------------------------------------------------------------------

/**
 * Alla beräkningskonstanter. Saknas raden används standardvärdena — inget
 * tal i appen kommer från en gissning.
 */
export function useParameters() {
  return useQuery({
    queryKey: ["user_parameters"],
    queryFn: async (): Promise<UserParameters> => {
      const { data, error } = await supabase.from("user_parameters").select("*").maybeSingle();
      if (error) throw error;
      return withDefaults(data as Partial<UserParameters> | null);
    },
    initialData: DEFAULT_PARAMETERS,
  });
}

export function useSaveParameters() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { next: UserParameters; previous: UserParameters }) => {
      const user_id = await uid();
      const { next, previous } = input;
      const row: Record<string, unknown> = { user_id };
      for (const f of PARAM_FIELDS) row[f.key] = next[f.key];
      const { error } = await supabase
        .from("user_parameters")
        .upsert(row as never, { onConflict: "user_id" });
      if (error) throw error;

      const changes = PARAM_FIELDS.filter((f) => String(previous[f.key]) !== String(next[f.key])).map(
        (f) => ({
          user_id,
          field: f.key,
          old_value: previous[f.key] == null ? null : String(previous[f.key]),
          new_value: next[f.key] == null ? null : String(next[f.key]),
        }),
      );
      if (changes.length > 0) {
        const { error: logError } = await supabase
          .from("parameter_changes")
          .insert(changes as never);
        if (logError) throw logError;
      }
      return changes.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_parameters"] });
      qc.invalidateQueries({ queryKey: ["parameter_changes"] });
    },
  });
}

export interface ParameterChange {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export function useParameterChanges() {
  return useQuery({
    queryKey: ["parameter_changes"],
    queryFn: async (): Promise<ParameterChange[]> => {
      const { data, error } = await supabase
        .from("parameter_changes")
        .select("*")
        .order("changed_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as ParameterChange[];
    },
  });
}
