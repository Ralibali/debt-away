/**
 * Kategorisering — regler först, AI sist.
 *
 * Reglerna är deterministiska och matchar på normaliserad beskrivning.
 * Först när ingen regel träffar får språkmodellen se beskrivningssträngarna
 * (aldrig belopp, saldon eller kontonummer).
 */

import { normalizeMerchant } from "./parse";

export type MatchType = "contains" | "exact" | "regex";

export interface MerchantRule {
  id: string;
  pattern: string;
  category_id: string;
  match_type: MatchType;
  hit_count: number;
}

export function ruleMatches(rule: MerchantRule, description: string): boolean {
  const target = normalizeMerchant(description);
  const pattern = rule.match_type === "regex" ? rule.pattern : normalizeMerchant(rule.pattern);
  if (pattern === "") return false;
  if (rule.match_type === "exact") return target === pattern;
  if (rule.match_type === "regex") {
    try {
      return new RegExp(rule.pattern, "i").test(description);
    } catch {
      return false;
    }
  }
  return target.includes(pattern);
}

/** Första träffen vinner; längre mönster prövas först. */
export function matchRule(rules: MerchantRule[], description: string): MerchantRule | null {
  const sorted = [...rules].sort((a, b) => b.pattern.length - a.pattern.length);
  return sorted.find((r) => ruleMatches(r, description)) ?? null;
}

/** Ett rimligt mönsterförslag från en beskrivning: de två första orden. */
export function suggestPattern(description: string): string {
  const words = normalizeMerchant(description).split(" ").filter(Boolean);
  return words.slice(0, 2).join(" ");
}
