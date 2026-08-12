import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { runCoachModule, type CoachModule as _M, type Json } from "@/lib/coach.functions";

export type CoachModule = "leaks" | "budget" | "friction" | "purchase" | "strategy";

export interface Leak {
  label: string;
  monthly_saving: number;
  difficulty: "lätt" | "medel" | "svår";
  life_impact: "ingen" | "liten" | "märkbar";
  priority: 1 | 2 | 3;
  action: string;
}

export interface LeaksPayload {
  leaks: Leak[];
  plan: { week: number; actions: string[] }[];
}

export interface BudgetPlan {
  headline: string;
  buckets: { name: string; monthly_limit: number; rationale: string }[];
  weekly_review: string[];
  guilt_free_amount: number;
  scripts: { situation: string; text: string }[];
}

export interface StrategyAdvice {
  recommended: "avalanche" | "snowball" | "hybrid";
  text: string;
}

export interface FrictionInsight {
  insight: string;
  tips: string[];
}

export interface PurchaseVerdict {
  verdict: "köp" | "vänta" | "avstå";
  motivering: string;
  alternativ: string | null;
}

/** Senast sparade analys för en modul, oavsett underlag. */
export function useLatestInsight<T>(module: CoachModule) {
  return useQuery({
    queryKey: ["ai_insights", module],
    queryFn: async (): Promise<{ payload: T; created_at: string; input_hash: string } | null> => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("payload, created_at, input_hash")
        .eq("module", module)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        payload: data.payload as T,
        created_at: String(data.created_at),
        input_hash: data.input_hash,
      };
    },
  });
}

/**
 * Kör en coachmodul. Anropas bara på uttryckligt användarklick — inga
 * automatiska regenereringar. Cachen i ai_insights träffas om underlaget är
 * oförändrat.
 */
export function useCoach<T>(module: CoachModule) {
  const qc = useQueryClient();
  const run = useServerFn(runCoachModule);
  return useMutation({
    mutationFn: async ({ input, force }: { input: Json; force?: boolean }): Promise<T> => {
      const res = await run({ data: { module, input, force: force ?? false } });
      return res.payload as T;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_insights", module] }),
  });
}

export type { Json };
export type CoachModuleServer = _M;
