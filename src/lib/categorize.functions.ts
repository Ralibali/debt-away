/**
 * AI-kategorisering — sista utvägen när ingen regel träffar.
 *
 * Endast beskrivningssträngar lämnar webbläsaren. Aldrig belopp, saldon,
 * kontonummer eller datum. Modellen returnerar bara ett kategorinamn ur en
 * lista vi själva skickar med.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CategorizeRequest {
  /** Normaliserade beskrivningssträngar, max 60 st */
  descriptions: string[];
  /** Tillåtna kategorinamn — modellen får inte hitta på egna */
  categories: string[];
}

export interface CategorizeResult {
  matches: { description: string; category: string | null }[];
}

export const categorizeDescriptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CategorizeRequest) => data)
  .handler(async ({ data }): Promise<CategorizeResult> => {
    const { callCategorizer } = await import("@/lib/categorize.server");
    if (data.descriptions.length === 0 || data.categories.length === 0) return { matches: [] };
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI-nyckeln saknas på servern.");
    return callCategorizer(data.descriptions.slice(0, 60), data.categories, apiKey);
  });
