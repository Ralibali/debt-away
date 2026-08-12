import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AmountMode, ColumnMap, DateFormat, ParsedRow } from "./parse";
import type { Encoding } from "./decode";
import type { MatchType, MerchantRule } from "./rules";

export interface ImportProfile {
  id: string;
  name: string;
  account_id: string | null;
  delimiter: string;
  encoding: Encoding;
  header_row: number;
  date_format: DateFormat;
  column_map: ColumnMap;
  amount_mode: AmountMode;
  sign_flip: boolean;
}

export function useImportProfiles() {
  return useQuery({
    queryKey: ["import_profiles"],
    queryFn: async (): Promise<ImportProfile[]> => {
      const { data, error } = await supabase.from("import_profiles").select("*").order("name");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        account_id: p.account_id,
        delimiter: p.delimiter,
        encoding: p.encoding as Encoding,
        header_row: p.header_row,
        date_format: p.date_format as DateFormat,
        column_map: p.column_map as unknown as ColumnMap,
        amount_mode: p.amount_mode as AmountMode,
        sign_flip: p.sign_flip,
      }));
    },
  });
}

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Inte inloggad");
  return data.user.id;
}

export function useSaveImportProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<ImportProfile> & { name: string }) => {
      const user_id = await uid();
      const payload = {
        user_id,
        name: p.name,
        account_id: p.account_id ?? null,
        delimiter: p.delimiter ?? ";",
        encoding: p.encoding ?? "utf-8",
        header_row: p.header_row ?? 0,
        date_format: p.date_format ?? "YYYY-MM-DD",
        column_map: p.column_map ?? {},
        amount_mode: p.amount_mode ?? "signed",
        sign_flip: p.sign_flip ?? false,
      } as never;
      if (p.id) {
        const { error } = await supabase.from("import_profiles").update(payload).eq("id", p.id);
        if (error) throw error;
        return p.id;
      }
      const { data, error } = await supabase
        .from("import_profiles")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import_profiles"] }),
  });
}

export function useDeleteImportProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("import_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import_profiles"] }),
  });
}

export function useMerchantRules() {
  return useQuery({
    queryKey: ["merchant_rules"],
    queryFn: async (): Promise<MerchantRule[]> => {
      const { data, error } = await supabase
        .from("merchant_rules")
        .select("*")
        .order("hit_count", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        pattern: r.pattern,
        category_id: r.category_id,
        match_type: r.match_type as MatchType,
        hit_count: r.hit_count,
      }));
    },
  });
}

export function useSaveMerchantRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: { pattern: string; category_id: string; match_type?: MatchType }) => {
      const user_id = await uid();
      const { error } = await supabase.from("merchant_rules").upsert(
        {
          user_id,
          pattern: r.pattern,
          category_id: r.category_id,
          match_type: r.match_type ?? "contains",
        } as never,
        { onConflict: "user_id,pattern,match_type" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merchant_rules"] }),
  });
}

export function useDeleteMerchantRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["merchant_rules"] }),
  });
}

/** Vilka import_hash som redan finns i databasen — dubbletter markeras i granskningen. */
export async function existingHashes(hashes: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < hashes.length; i += 200) {
    const chunk = hashes.slice(i, i + 200);
    const { data, error } = await supabase
      .from("transactions")
      .select("import_hash")
      .in("import_hash", chunk);
    if (error) throw error;
    for (const row of data ?? []) if (row.import_hash) found.add(row.import_hash);
  }
  return found;
}

export interface ReviewRow extends ParsedRow {
  category_id: string | null;
  /** Hur kategorin sattes: regel, AI-förslag eller manuellt */
  categorySource: "rule" | "ai" | "manual" | null;
  duplicate: boolean;
  include: boolean;
}

/** Skriver godkända rader till transactions. Inget skrivs utan detta steg. */
export function useCommitImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { rows: ReviewRow[]; accountId: string | null }) => {
      const user_id = await uid();
      const rows = input.rows.filter((r) => r.include && !r.duplicate);
      if (rows.length === 0) return 0;
      const payload = rows.map((r) => ({
        user_id,
        account_id: input.accountId,
        category_id: r.category_id,
        occurred_at: r.occurred_at,
        booking_date: r.booking_date,
        amount: r.amount,
        description: r.description || null,
        raw_description: r.raw_description || null,
        import_hash: r.import_hash ?? null,
        source: "import",
        is_recurring: false,
      }));
      const { error } = await supabase.from("transactions").insert(payload as never);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
}
