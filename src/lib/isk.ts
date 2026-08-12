/**
 * Schablonskatt på ISK och kapitalförsäkring.
 *
 * Konstanterna kommer i första hand från användarens egna parametrar. Den
 * daterade tabellen är kvar som fallback för historiska år.
 * Ingen AI, ingen gissning — bara räkning.
 */

import { DEFAULT_PARAMETERS, type UserParameters } from "@/lib/parameters";

export interface IskConstants {
  /** Fribelopp per person, gemensamt för ISK + KF + PEPP */
  fribelopp: number;
  /** Statslåneränta 30 nov föregående år + 1 procentenhet, golv 1,25 % */
  schablonranta: number;
  /** Kapitalskatt */
  kapitalskatt: number;
}

/** Daterad tabell — fallback när användaren inte satt egna parametrar. */
export const ISK_CONSTANTS: Record<number, IskConstants> = {
  2025: { fribelopp: 150_000, schablonranta: 0.0296, kapitalskatt: 0.3 },
  // 2026: statslåneränta 2,55 % + 1 procentenhet
  2026: { fribelopp: 300_000, schablonranta: 0.0355, kapitalskatt: 0.3 },
};

export const ISK_LATEST_YEAR = 2026;

/**
 * Parametrarna gäller innevarande/senaste år. För äldre år används tabellen,
 * eftersom en manuell parameter aldrig ska skriva om historiken.
 */
export function iskConstants(year: number, p?: UserParameters | null): IskConstants {
  if (p && year >= ISK_LATEST_YEAR) {
    return {
      fribelopp: p.isk_fribelopp,
      schablonranta: p.isk_schablonranta,
      kapitalskatt: p.kapitalskatt,
    };
  }
  return ISK_CONSTANTS[year] ?? ISK_CONSTANTS[ISK_LATEST_YEAR]!;
}

/** De fyra mätdagarna för kapitalunderlaget. */
export function quarterDates(year: number): string[] {
  return [`${year}-01-01`, `${year}-04-01`, `${year}-07-01`, `${year}-10-01`];
}

export interface IskInput {
  /** Värde vid 1 jan, 1 apr, 1 jul, 1 okt. null = mätdagen har inte inträffat/saknar avstämning. */
  quarterValues: (number | null)[];
  /** Årets insättningar, samtliga ISK/KF summerade */
  depositsThisYear: number;
}

export interface IskResult {
  year: number;
  constants: IskConstants;
  /** (summa mätdagsvärden + årets insättningar) / 4 */
  kapitalunderlag: number;
  /** Hur många av de fyra mätdagarna som har ett värde */
  measuredQuarters: number;
  /** Kvar till fribeloppet, 0 om det passerats */
  toFribelopp: number;
  /** Belopp över fribeloppet */
  overFribelopp: number;
  /** Uppskattad schablonskatt för året */
  tax: number;
  /** true om kapitalunderlaget ligger under fribeloppet */
  taxFree: boolean;
}

/**
 * kapitalunderlag = (värdet 1 jan + 1 apr + 1 jul + 1 okt + årets insättningar) / 4
 * skatt = max(0, kapitalunderlag − fribelopp) × schablonränta × kapitalskatt
 *
 * Fribeloppet gäller per person och delas mellan alla ISK och KF — summera
 * kontona före avdraget, dra aldrig 300 000 kr per konto.
 */
export function iskTax(input: IskInput, year: number = ISK_LATEST_YEAR): IskResult {
  const constants = iskConstants(year);
  const measured = input.quarterValues.filter((v): v is number => v != null);
  const sum = measured.reduce((a, b) => a + b, 0) + input.depositsThisYear;
  const kapitalunderlag = sum / 4;
  const overFribelopp = Math.max(0, kapitalunderlag - constants.fribelopp);
  return {
    year,
    constants,
    kapitalunderlag,
    measuredQuarters: measured.length,
    toFribelopp: Math.max(0, constants.fribelopp - kapitalunderlag),
    overFribelopp,
    tax: overFribelopp * constants.schablonranta * constants.kapitalskatt,
    taxFree: overFribelopp <= 0,
  };
}
