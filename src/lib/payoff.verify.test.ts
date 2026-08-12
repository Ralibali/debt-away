/**
 * Verifieringssvit mot facit i ögonblicksbilden 2026-08-12.
 * Producerar payoff.ts andra siffror är motorn fel, inte facit.
 */
import { describe, expect, it } from "vitest";
import { REFERENCE_LOANS as L, SMALL_SEVEN, SNAPSHOT_DATE } from "@/lib/seed-portfolio";
import {
  simulate,
  minimumPayment,
  monthlyFee,
  monthlyInterest,
  currentMonthlyInterest,
  type Loan,
} from "@/lib/payoff";

const byId = (id: string): Loan => L.find((l) => l.id === id)!;
const sum = (f: (l: Loan) => number, list: Loan[] = L) => list.reduce((s, l) => s + f(l), 0);

const totalDebt = sum((l) => l.current_balance);
const feesTotal = sum(monthlyFee);
const interestTotal = currentMonthlyInterest(L);
const minsTotal = sum((l) => minimumPayment(l, l.current_balance));

describe("Nuläge", () => {
  it("total skuld 509 142 kr", () => expect(totalDebt).toBeCloseTo(509141.92, 2));

  it("viktad nominell ränta 15,33 %", () => {
    const weighted = sum((l) => l.nominal_rate * l.current_balance) / totalDebt;
    expect(weighted).toBeCloseTo(15.33, 1);
  });

  it("ränta 6 503 kr/mån", () => expect(Math.round(interestTotal)).toBe(6503));
  it("avgifter 535 kr/mån", () => expect(feesTotal).toBe(535));
  it("ränta + avgifter 7 038 kr/mån (84 456 kr/år)", () => {
    expect(Math.round(interestTotal + feesTotal)).toBe(7038);
    expect(Math.round((interestTotal + feesTotal) * 12)).toBe(84456);
  });
  it("summa minimibetalningar ~13 470 kr/mån", () => {
    expect(minsTotal).toBeGreaterThan(13460);
    expect(minsTotal).toBeLessThan(13480);
  });
  it("därav ~6 432 kr till skulden", () =>
    expect(Math.round(minsTotal - interestTotal - feesTotal)).toBe(6432));
});

describe("Enskilda lån", () => {
  const brocc = byId("brocc");

  it("Brocc, 4 470 kr/mån: 158 mån och 379 491 kr ränta", () => {
    const r = simulate([brocc], 0, "baseline", SNAPSHOT_DATE);
    expect(r.months).toBe(158);
    expect(Math.round(r.totalInterest)).toBe(379491);
  });

  it("Brocc, första månaden: 3 727 kr ränta, 743 kr till skulden", () => {
    const row = simulate([brocc], 0, "baseline", SNAPSHOT_DATE).schedule[0]!.payments["brocc"]!;
    expect(Math.round(row.interest)).toBe(3727);
    expect(Math.round(row.principal)).toBe(743);
  });

  it("Brocc, +6 000 kr/mån: 39 mån och 79 234 kr ränta", () => {
    const r = simulate([brocc], 6000, "avalanche", SNAPSHOT_DATE);
    expect(r.months).toBe(39);
    expect(Math.round(r.totalInterest)).toBe(79234);
  });

  it("Brixo, enbart minimum: 28 mån, ~2 491 kr ränta", () => {
    const r = simulate([byId("brixo")], 0, "baseline", SNAPSHOT_DATE);
    expect(r.months).toBe(28);
    expect(r.totalInterest).toBeGreaterThan(2450);
    expect(r.totalInterest).toBeLessThan(2530);
  });

  it("Brixo, första månaden: 161 kr ränta av 400 kr", () => {
    const brixo = byId("brixo");
    expect(Math.round(monthlyInterest(brixo, brixo.current_balance))).toBe(161);
    expect(minimumPayment(brixo, brixo.current_balance)).toBe(400);
  });

  it("Northmill: 16,3 % utan avgift, ~24,9 % effektivt med avgiften", () => {
    const nm = byId("northmill");
    expect(nm.nominal_rate).toBe(16.3);
    const withFee = ((monthlyInterest(nm, nm.current_balance) + 330) * 12 * 100) / nm.current_balance;
    expect(withFee).toBeGreaterThan(24.6);
    expect(withFee).toBeLessThan(25.2);
  });

  it("Northmill: ~953 kr av månadskostnaden är ränta + avgift", () => {
    // OBS: motorn lägger avgiften OVANPÅ minimibetalningen (1 608 + 330),
    // eftersom minimibetalningen i databasen är beloppet som går till krediten.
    // Räknas de 330 kr in i autogirot på 1 608 kr blir 655 kr kvar till skulden.
    const nm = byId("northmill");
    const row = simulate([nm], 0, "baseline", SNAPSHOT_DATE).schedule[0]!.payments[nm.id]!;
    expect(row.interest + row.fee).toBeGreaterThan(945);
    expect(row.interest + row.fee).toBeLessThan(962);
    expect(Math.round(1608 - row.interest - row.fee)).toBeGreaterThan(645);
    expect(Math.round(1608 - row.interest - row.fee)).toBeLessThan(665);
  });
});

describe("Kapitalinsatsscenariot — de sju små", () => {
  const small = L.filter((l) => SMALL_SEVEN.includes(l.id));
  const rest = L.filter((l) => !SMALL_SEVEN.includes(l.id));

  it("summa 83 185,24 kr", () =>
    expect(sum((l) => l.current_balance, small)).toBeCloseTo(83185.24, 2));

  it("kostar ~1 499 kr/mån (1 294 ränta + 205 avgifter)", () => {
    const interest = sum((l) => monthlyInterest(l, l.current_balance), small);
    const fees = sum(monthlyFee, small);
    expect(Math.round(interest)).toBe(1294);
    expect(fees).toBe(205);
    expect(Math.round(interest + fees)).toBe(1499);
  });

  it("avkastning på insats 21,6 % skattefritt", () => {
    const cost = sum((l) => monthlyInterest(l, l.current_balance) + monthlyFee(l), small);
    expect(((cost * 12) / sum((l) => l.current_balance, small)) * 100).toBeCloseTo(21.6, 1);
  });

  it("frigör ~4 923 kr/mån i minimibetalningar", () =>
    expect(Math.round(sum((l) => minimumPayment(l, l.current_balance), small))).toBe(4923));

  it("kvar efteråt: 3 krediter, 425 957 kr", () => {
    expect(rest).toHaveLength(3);
    expect(sum((l) => l.current_balance, rest)).toBeCloseTo(425956.68, 2);
  });

  it("med insats och 13 470 kr/mån: skuldfri på ~40 mån", () => {
    const restMin = sum((l) => minimumPayment(l, l.current_balance), rest);
    const r = simulate(rest, minsTotal - restMin, "avalanche", SNAPSHOT_DATE);
    expect(r.months).toBe(40);
    expect(r.totalInterest).toBeLessThan(115000);
    const monthOf = (id: string) => r.perLoan.find((p) => p.loanId === id)!.payoffMonth!;
    expect(monthOf("nordax")).toBeLessThanOrEqual(monthOf("northmill"));
    expect(monthOf("northmill")).toBeLessThan(monthOf("brocc"));
  });

  it("utan insats, samma betalning mot alla tio: ~52 mån och klart dyrare", () => {
    const withInfusion = simulate(
      L.filter((l) => !SMALL_SEVEN.includes(l.id)),
      minsTotal - sum((l) => minimumPayment(l, l.current_balance), rest),
      "avalanche",
      SNAPSHOT_DATE,
    );
    const without = simulate(L, 0, "avalanche", SNAPSHOT_DATE);
    expect(without.months).toBeGreaterThanOrEqual(50);
    expect(without.months).toBeLessThanOrEqual(54);
    expect(without.months! - withInfusion.months!).toBeGreaterThanOrEqual(10);
    expect(without.totalInterest - withInfusion.totalInterest).toBeGreaterThan(60000);
  });
});
