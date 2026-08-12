/**
 * Köpbeslut och delbetalning — hela kalkylen körs här, aldrig av en modell.
 */

import {
  effectiveRate,
  highestRateLoan,
  revolvingWithInterest,
  simulate,
  type Loan,
  type Strategy,
} from "@/lib/payoff";

export type PaymentMethod = "kontant" | "kort" | "delbetalning";

export interface PurchaseInput {
  what: string;
  price: number;
  method: PaymentMethod;
  /** Nominell årsränta i procent på delbetalningen, 0 om räntefri */
  apr: number;
  months: number;
  /** Aviavgift per månad */
  invoiceFee: number;
  netHourlyWage: number;
}

export interface PurchaseCalc {
  price: number;
  months: number;
  monthlyPayment: number;
  totalInterest: number;
  totalFees: number;
  totalCost: number;
  /** Aviavgifternas verkliga kostnad uttryckt som effektiv årsränta */
  feeEffectiveApr: number;
  /** Total effektiv årsränta inklusive ränta och avgifter */
  effectiveApr: number;
  hoursOfWork: number | null;
  /** Alternativkostnad: samma belopp lagt på dyraste lånet i stället */
  opportunity: {
    loanName: string | null;
    monthsEarlier: number | null;
    interestSaved: number;
    debtFreeWith: string | null;
    debtFreeWithout: string | null;
  };
  /** Hård regel: dyr revolverande skuld + ny delbetalning = rött */
  redFlag: boolean;
  redFlagReason: string | null;
}

function annuityPayment(principal: number, monthlyRate: number, months: number): number {
  if (months <= 0) return principal;
  if (monthlyRate <= 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

/** Internränta för en serie lika stora betalningar — bisektion, deterministisk. */
function impliedMonthlyRate(principal: number, payment: number, months: number): number {
  if (principal <= 0 || months <= 0 || payment * months <= principal) return 0;
  let lo = 0;
  let hi = 1; // 100 %/mån som tak
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    let pv = 0;
    for (let t = 1; t <= months; t++) pv += payment / Math.pow(1 + mid, t);
    if (pv > principal) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function toApr(monthlyRate: number): number {
  return Math.round((Math.pow(1 + monthlyRate, 12) - 1) * 100 * 100) / 100;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computePurchase(
  input: PurchaseInput,
  loans: Loan[],
  extraPerMonth: number,
  strategy: Strategy = "avalanche",
  today: Date = new Date(),
): PurchaseCalc {
  const months = input.method === "delbetalning" ? Math.max(1, Math.round(input.months)) : 1;
  const monthlyRate = input.method === "delbetalning" ? input.apr / 100 / 12 : 0;
  const fee = input.method === "delbetalning" ? Math.max(0, input.invoiceFee) : 0;

  const basePayment =
    input.method === "delbetalning" ? annuityPayment(input.price, monthlyRate, months) : input.price;
  const totalInterest =
    input.method === "delbetalning" ? Math.max(0, basePayment * months - input.price) : 0;
  const totalFees = fee * months;
  const totalCost = input.price + totalInterest + totalFees;

  // Räntefri delbetalning är inte gratis: aviavgiften ensam motsvarar en ränta.
  const feeOnlyPayment = input.price / months + fee;
  const feeEffectiveApr =
    input.method === "delbetalning" && fee > 0
      ? toApr(impliedMonthlyRate(input.price, feeOnlyPayment, months))
      : 0;
  const effectiveApr =
    input.method === "delbetalning"
      ? toApr(impliedMonthlyRate(input.price, basePayment + fee, months))
      : 0;

  // Alternativkostnad: kör simulate() två gånger — med och utan beloppet.
  const target = highestRateLoan(loans);
  const withPurchase = simulate(loans, extraPerMonth, strategy, today);
  const loansWithLump = target
    ? loans.map((l) =>
        l.id === target.id
          ? { ...l, current_balance: Math.max(0, l.current_balance - totalCost) }
          : l,
      )
    : loans;
  const withoutPurchase = simulate(loansWithLump, extraPerMonth, strategy, today);

  const monthsEarlier =
    withPurchase.months != null && withoutPurchase.months != null
      ? withPurchase.months - withoutPurchase.months
      : null;

  const revolving = revolvingWithInterest(loans);
  const redFlag = input.method === "delbetalning" && revolving.length > 0;

  return {
    price: round(input.price),
    months,
    monthlyPayment: round(input.method === "delbetalning" ? basePayment + fee : input.price),
    totalInterest: round(totalInterest),
    totalFees: round(totalFees),
    totalCost: round(totalCost),
    feeEffectiveApr,
    effectiveApr,
    hoursOfWork:
      input.netHourlyWage > 0 ? Math.round((totalCost / input.netHourlyWage) * 10) / 10 : null,
    opportunity: {
      loanName: target?.name ?? null,
      monthsEarlier,
      interestSaved: round(withPurchase.totalInterest - withoutPurchase.totalInterest),
      debtFreeWith: withPurchase.debtFreeDate,
      debtFreeWithout: withoutPurchase.debtFreeDate,
    },
    redFlag,
    redFlagReason: redFlag
      ? `Du har revolverande skuld med ${Math.max(
          ...revolving.map((l) => effectiveRate(l)),
        ).toFixed(1)} % effektiv ränta kvar (${revolving
          .map((l) => l.name)
          .join(", ")}). Ny delbetalning medan dyr skuld ligger kvar är att låna för att låna.`
      : null,
  };
}

/** Statiska faktarutor — aldrig AI-genererade. */
export const CREDIT_FACTS = [
  "Ränta på konsumentkrediter är inte avdragsgill från inkomståret 2026.",
  "Det finns ett räntetak och ett kostnadstak på konsumentkrediter — totalkostnaden får inte överstiga lånebeloppet.",
  "Ny konsumentkreditlag gäller från 20 november 2026 och omfattar även räntefria BNPL-upplägg, med skärpt kreditprövning.",
] as const;
