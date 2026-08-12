/**
 * Serverdel för AI-kategorisering av butiksnamn.
 * Modellen får bara textsträngar och en lista tillåtna kategorier.
 */

import type { CategorizeResult } from "@/lib/categorize.functions";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.5-flash";

const SYSTEM = `Du kategoriserar svenska butiks- och betalningsbeskrivningar från ett kontoutdrag.
Du får en lista beskrivningar och en lista tillåtna kategorinamn. Välj för varje beskrivning ETT kategorinamn ur listan, exakt stavat, eller null om du är osäker.
Du får aldrig hitta på nya kategorinamn, aldrig räkna, aldrig kommentera. Ingen inledning, inga kodstaket.
Returnera JSON exakt så här: {"matches":[{"description":string,"category":string|null}]}`;

function stripFences(text: string): string {
  const t = text.trim();
  if (!t.startsWith("```")) return t;
  return t.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "").trim();
}

export async function callCategorizer(
  descriptions: string[],
  categories: string[],
  apiKey: string,
): Promise<CategorizeResult> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify({ descriptions, categories }) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("För många förfrågningar just nu — försök om en stund.");
  if (res.status === 402) throw new Error("AI-krediterna är slut. Fyll på i arbetsytans inställningar.");
  if (!res.ok) throw new Error(`AI-tjänsten svarade ${res.status}.`);

  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("Tomt svar från AI-tjänsten.");

  let parsed: CategorizeResult;
  try {
    parsed = JSON.parse(stripFences(content)) as CategorizeResult;
  } catch {
    throw new Error("Svaret gick inte att tolka som JSON.");
  }

  const allowed = new Set(categories);
  return {
    matches: (parsed.matches ?? [])
      .filter((m) => typeof m?.description === "string")
      .map((m) => ({
        description: m.description,
        category: m.category && allowed.has(m.category) ? m.category : null,
      })),
  };
}
