/**
 * Beröm för handlingar, inte utfall. Allt hämtas ur faktiska händelser under
 * fasen. Finns ingen handling att peka på skrivs ingenting alls.
 */

import type { Transaction } from "@/lib/data";
import type { WishlistItem } from "@/lib/wishlist";
import type { IntentionEvent } from "@/lib/intentions";
import { inWindow, type PhaseWindow } from "@/lib/phase";

export interface WinInput {
  window: PhaseWindow;
  wishlist: WishlistItem[];
  intentionEvents: IntentionEvent[];
  transactions: Transaction[];
  /** Extrainbetalningar på lån under fasen */
  extraPayments: { paid_at: string; amount: number; is_extra: boolean }[];
}

export function wins(input: WinInput): string[] {
  const w = input.window;
  const out: string[] = [];

  const waited = input.wishlist.filter(
    (i) =>
      i.decision === "avstått" &&
      i.decided_at != null &&
      inWindow(i.decided_at.slice(0, 10), w),
  ).length;
  if (waited > 0) {
    out.push(
      waited === 1
        ? "Du väntade ut kylperioden på en sak den här fasen."
        : `Du väntade ut kylperioden på ${waited} saker den här fasen.`,
    );
  }

  const kept = input.intentionEvents.filter((e) => e.fulfilled && inWindow(e.due_on, w)).length;
  if (kept > 0) {
    out.push(
      kept === 1
        ? "En av dina regler blev av precis som du skrev den."
        : `${kept} av dina regler blev av precis som du skrev dem.`,
    );
  }

  const extra = input.extraPayments
    .filter((p) => p.is_extra && inWindow(p.paid_at, w))
    .reduce((s, p) => s + p.amount, 0);
  if (extra > 0) {
    out.push(`Du la ${Math.round(extra).toLocaleString("sv-SE")} kr extra på skulden.`);
  }

  const categorized = input.transactions.filter(
    (t) => inWindow(t.occurred_at, w) && t.category_id != null,
  ).length;
  const total = input.transactions.filter((t) => inWindow(t.occurred_at, w)).length;
  if (total > 0 && categorized === total && total >= 3) {
    out.push("Alla poster den här fasen är kategoriserade.");
  }

  return out;
}
