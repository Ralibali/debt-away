import { useMemo, useState } from "react";
import type { Loan, PayoffResult } from "@/lib/payoff";
import { kr, manad } from "@/lib/format";
import { Button } from "@/components/ui/button";

const PAGE = 12;

export function PaymentSchedule({ result, loans }: { result: PayoffResult; loans: Loan[] }) {
  const [visible, setVisible] = useState(PAGE);
  const [loanId, setLoanId] = useState<string | "alla">("alla");

  const names = useMemo(() => new Map(loans.map((l) => [l.id, l.name])), [loans]);

  const rows = useMemo(() => {
    return result.schedule.map((row) => {
      const payments = Object.values(row.payments).filter(
        (p) => loanId === "alla" || p.loanId === loanId,
      );
      return {
        month: row.month,
        date: row.date,
        payments,
        minimum: payments.reduce((s, p) => s + p.minimum, 0),
        extra: payments.reduce((s, p) => s + p.extra, 0),
        total: payments.reduce((s, p) => s + p.total, 0),
      };
    });
  }, [result, loanId]);

  const shown = rows.slice(0, visible);

  if (rows.length === 0) return null;

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
        <div className="label-xs">Betalningsplan per månad</div>
        <div className="flex flex-wrap gap-1">
          <FilterChip active={loanId === "alla"} onClick={() => setLoanId("alla")}>
            Alla lån
          </FilterChip>
          {loans.map((l) => (
            <FilterChip key={l.id} active={loanId === l.id} onClick={() => setLoanId(l.id)}>
              {l.name}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">Månad / lån</th>
              <th className="px-3 py-1.5 text-right font-medium">Minimum</th>
              <th className="px-3 py-1.5 text-right font-medium">Extra</th>
              <th className="px-3 py-1.5 text-right font-medium">Ränta</th>
              <th className="px-3 py-1.5 text-right font-medium">Totalt</th>
              <th className="px-3 py-1.5 text-right font-medium">Saldo efter</th>
            </tr>
          </thead>
          {shown.map((row) => (
            <tbody key={row.month}>
              <tr className="border-b border-border/60 bg-muted/30">
                <td className="px-3 py-1.5 text-xs font-medium">
                  {manad(row.date)}
                  <span className="ml-1.5 text-muted-foreground">mån {row.month}</span>
                </td>
                <td className="num px-3 py-1.5 text-right text-xs">{kr(row.minimum)}</td>
                <td className="num px-3 py-1.5 text-right text-xs text-primary">
                  {row.extra > 0 ? kr(row.extra) : "–"}
                </td>
                <td className="px-3 py-1.5" />
                <td className="num px-3 py-1.5 text-right text-xs font-semibold">
                  {kr(row.total)}
                </td>
                <td className="px-3 py-1.5" />
              </tr>
              {row.payments.map((p) => (
                <tr key={p.loanId} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5 pl-6 pr-3 text-[0.8rem]">
                    {names.get(p.loanId) ?? "Lån"}
                    {p.extra > 0 && (
                      <span className="ml-1.5 rounded bg-primary/15 px-1 text-[0.6rem] text-primary">
                        målet
                      </span>
                    )}
                  </td>
                  <td className="num px-3 py-1.5 text-right">{kr(p.minimum)}</td>
                  <td className="num px-3 py-1.5 text-right text-primary">
                    {p.extra > 0 ? kr(p.extra) : "–"}
                  </td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">
                    {kr(p.interest)}
                  </td>
                  <td className="num px-3 py-1.5 text-right font-medium">{kr(p.total)}</td>
                  <td className="num px-3 py-1.5 text-right">
                    {p.balance <= 0 ? (
                      <span className="text-primary">Slutbetald</span>
                    ) : (
                      kr(p.balance)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-2 text-[0.7rem] text-muted-foreground">
        <span>
          Visar {shown.length} av {rows.length} månader
        </span>
        {visible < rows.length && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setVisible((v) => v + PAGE)}>
              Visa 12 till
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setVisible(rows.length)}>
              Visa alla
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-1.5 py-0.5 text-[0.7rem] transition-colors ${
        active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
