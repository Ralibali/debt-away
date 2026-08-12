/**
 * Serverdel för coachmodulerna.
 *
 * Grundregel: modellen får bara färdiga siffror. Systemprompterna förbjuder
 * uttryckligen egna beräkningar, och varje svar är strikt JSON.
 */

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.5-flash";

const NO_MATH =
  "Du får ALDRIG räkna ut, uppskatta eller ändra ett belopp, en räntesats, ett datum eller en summa. " +
  "Alla siffror finns redan i underlaget och ska återges exakt som de står. " +
  "Svara med enbart giltig JSON, ingen inledning, ingen förklaring, inga kodstaket.";

export type CoachModule = "leaks" | "budget" | "friction" | "purchase" | "strategy";

const SYSTEM_PROMPTS: Record<CoachModule, string> = {
  leaks: `Du är en svensk privatekonomisk coach. ${NO_MATH}
Du får en lista med kandidater till utgiftsläckor där varje post redan har ett uträknat månadsbelopp.
Välj ut de mest relevanta (max 8) och returnera JSON exakt så här:
{"leaks":[{"label":string,"monthly_saving":number,"difficulty":"lätt"|"medel"|"svår","life_impact":"ingen"|"liten"|"märkbar","priority":1|2|3,"action":string}],"plan":[{"week":1|2|3|4,"actions":[string]}]}
monthly_saving MÅSTE vara exakt ett av de monthly_amount som skickades in — hitta aldrig på ett eget belopp.
priority 1 = gör först. action är en konkret mening om vad som ska göras, inte ett allmänt råd.
plan är en 30-dagarsplan i fyra veckor, max tre åtgärder per vecka, lättast först. Skriv på svenska, utan skam och utan pekpinnar.`,

  budget: `Du är en svensk privatekonomisk coach som gör budget utan skam. ${NO_MATH}
Du får inkomst, fasta kostnader, minimibetalningar på lån, disponibelt belopp efter fasta kostnader och minimibetalningar, samt tre månaders faktiskt utfall per kategori.
Fördela ENBART det disponibla beloppet. Använd inte mallen 50/30/20. Om skuldbetalningarna redan tar mer än 20 % av inkomsten ska du säga det rakt ut i rationale, inte trycka in verkligheten i en mall.
Summan av buckets monthly_limit får inte överstiga disponibelt belopp. Returnera JSON exakt så här:
{"headline":string,"buckets":[{"name":string,"monthly_limit":number,"rationale":string}],"weekly_review":[string],"guilt_free_amount":number,"scripts":[{"situation":string,"text":string}]}
weekly_review: 3–5 punkter som tar max 10 minuter att gå igenom. guilt_free_amount är ett VECKOBELOPP som får spenderas utan motivering och måste rymmas i det disponibla beloppet.
scripts: exakt 5 stycken för situationerna middag ute, resa med vänner, födelsedagspresent, delad gruppbeställning, spontant "ut ikväll". Korta, vardagliga repliker som inte förklarar privatekonomi för mottagaren.`,

  strategy: `Du är en svensk privatekonomisk coach. ${NO_MATH}
Du får tre färdigräknade avbetalningsstrategier (Lavin, Snöboll, Hybrid) med antal månader, skuldfritt-datum, total räntekostnad och ordningsföljd. Belopp och datum är redan formaterade på svenska.
Skriv 3–5 meningar om vilken som passar den här personen och varför. Räkna inte om något, jämför bara de tal du fått, och skriv belopp och datum EXAKT som de står i underlaget (t.ex. "25 524 kr", "januari 2029"). Använd de svenska strateginamnen Lavin, Snöboll och Hybrid i texten.
Returnera JSON exakt så här: {"recommended":"avalanche"|"snowball"|"hybrid","text":string} där recommended är nyckeln för den strategi du rekommenderar.`,

  friction: `Du är en svensk privatekonomisk coach. ${NO_MATH}
Du får statistik över önskelistan: humör vid inmatning och hur ofta varje humör slutar i avstått.
Returnera JSON exakt så här: {"insight":string,"tips":[string]}
insight är 2–3 meningar om vilket humör som oftast leder till köp respektive avstått. tips är max 3 konkreta meningar. Ingen skam, ingen gamification.`,

  purchase: `Du är en svensk privatekonomisk coach. ${NO_MATH}
Du får ett färdigräknat köpbeslut: totalkostnad, ränta, aviavgifter, effektiv ränta, timmar av nettolön och alternativkostnad mot dyraste lånet.
Om red_flag är true ska verdict vara "avstå" eller "vänta" — ny delbetalning medan dyr revolverande skuld ligger kvar är inte försvarbart.
Returnera JSON exakt så här: {"verdict":"köp"|"vänta"|"avstå","motivering":string,"alternativ":string|null}
motivering är exakt tre meningar. alternativ är ett konkret förslag när verdict inte är "köp", annars null.`,
};

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```[a-zA-Z]*\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
}

export async function callCoachModel(
  module: CoachModule,
  input: unknown,
  apiKey: string,
): Promise<unknown> {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[module] },
        { role: "user", content: JSON.stringify(input) },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("För många förfrågningar just nu — försök om en stund.");
  if (res.status === 402) throw new Error("AI-krediterna är slut. Fyll på i arbetsytans inställningar.");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI-tjänsten svarade ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Tomt svar från AI-tjänsten.");

  try {
    return JSON.parse(stripFences(content));
  } catch {
    throw new Error("Svaret gick inte att tolka som JSON. Försök igen.");
  }
}
