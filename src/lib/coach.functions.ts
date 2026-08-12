import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CoachRequest {
  module: "leaks" | "budget" | "friction" | "purchase" | "strategy";
  input: unknown;
  /** true = ignorera cachen och generera om (bara på uttryckligt användarklick) */
  force?: boolean;
}

export interface CoachResponse {
  payload: unknown;
  cached: boolean;
  created_at: string;
  input_hash: string;
}

export const runCoachModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CoachRequest) => data)
  .handler(async ({ data, context }): Promise<CoachResponse> => {
    const { sha256Hex, callCoachModel } = await import("@/lib/coach.server");
    const { supabase, userId } = context;
    const inputHash = await sha256Hex(`${data.module}:${JSON.stringify(data.input)}`);

    if (!data.force) {
      const { data: cached } = await supabase
        .from("ai_insights")
        .select("payload, created_at")
        .eq("module", data.module)
        .eq("input_hash", inputHash)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached) {
        return {
          payload: cached.payload,
          cached: true,
          created_at: String(cached.created_at),
          input_hash: inputHash,
        };
      }
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI-nyckeln saknas på servern.");

    const payload = await callCoachModel(data.module, data.input, apiKey);

    const { error } = await supabase
      .from("ai_insights")
      .upsert(
        { user_id: userId, module: data.module, input_hash: inputHash, payload } as never,
        { onConflict: "user_id,module,input_hash" },
      );
    if (error) throw new Error(error.message);

    return {
      payload,
      cached: false,
      created_at: new Date().toISOString(),
      input_hash: inputHash,
    };
  });
