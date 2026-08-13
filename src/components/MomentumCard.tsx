import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleCheckBig, HandCoins, ShieldCheck, TrendingDown } from "lucide-react";
import { useAllLoanPayments, useLoans, useWishlist } from "@/lib/data";
import { kr } from "@/lib/format";
import { minimumPayment, type Loan } from "@/lib/payoff";
import { savedTotal } from "@/lib/wishlist";

const EPSILON = 0.01;

function currentMonthlyCommitment(loan: Loan) {
  return minimumPayment(loan, loan.current_balance) + (loan.monthly_fee ?? 0);
}

function releasedMonthlyCommitment(loan: Loan) {
  return (loan.min_payment ?? 0) + (loan.monthly_fee ?? 0);
}

export function MomentumCard() {
  const { data: loans = [] } = useLoans();
  const { data: payments = [] } = useAllLoanPayments();
  const { data: wishes = [] } = useWishlist();

  if (loans.length === 0) return null;

  const active = loans.filter((loan) => loan.current_balance > EPSILON);
  const closed = loans.filter((loan) => loan.current_balance <= EPSILON);

  const recordedPrincipal = payments.reduce((sum, payment) => sum + (payment.principal_part ?? 0), 0);
  const balanceDelta = loans.reduce((sum, loan) => {
    if (loan.original_amount == null) return sum;
    return sum + Math.max(0, loan.original_amount - loan.current_balance);
  }, 0);
  const paidDown = Math.max(recordedPrincipal, balanceDelta);
  const freedMonthly = closed.reduce((sum, loan) => sum + releasedMonthlyCommitment(loan), 0);
  const savedFromImpulses = savedTotal(wishes);
  const waiting = wishes.filter((wish) => wish.decision === "väntar").length;

  const nextCashflowWin = active
    .map((loan) => {
      const monthly = currentMonthlyCommitment(loan);
      return {
        loan,
        monthly,
        efficiency: loan.current_balance > 0 ? monthly / loan.current_balance : 0,
      };
    })
    .filter((item) => item.monthly > 0)
    .sort(
      (a, b) =>
        b.efficiency - a.efficiency ||
        b.monthly - a.monthly ||
        b.loan.nominal_rate - a.loan.nominal_rate,
    )[0];

  const identityLine =
    closed.length > 0
      ? `${closed.length} ${closed.length === 1 ? "skuld är" : "skulder är"} redan borta. Det är betalningar du har tagit ur framtida månader.`
      : "Första målet behöver inte vara skuldfrihet. Första målet kan vara att få bort en hel månadsbetalning.";

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="size-4 text-saving" />
          <div className="label-xs">Ekonomiskt momentum</div>
        </div>
        <p className="mt-3 text-18 font-medium leading-snug">{identityLine}</p>
        {paidDown > 0 && (
          <p className="mt-1 text-13 text-muted-foreground">
            Minst <span className="num font-medium text-foreground">{kr(paidDown)}</span> i registrerad amortering eller saldominskning hittills.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        <div className="p-3 sm:p-4">
          <div className="label-xs">Borta</div>
          <div className="num mt-1 text-18">{closed.length}</div>
          <div className="mt-0.5 text-[0.7rem] text-muted-foreground">av {loans.length} skulder</div>
        </div>
        <div className="p-3 sm:p-4">
          <div className="label-xs">Frigjort/mån</div>
          <div className="num mt-1 text-18">{kr(freedMonthly)}</div>
          <div className="mt-0.5 text-[0.7rem] text-muted-foreground">från lösta lån</div>
        </div>
        <div className="p-3 sm:p-4">
          <div className="label-xs">Avstått</div>
          <div className="num mt-1 text-18">{kr(savedFromImpulses)}</div>
          <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
            {waiting > 0 ? `${waiting} köp kyls` : "via impulsbromsen"}
          </div>
        </div>
      </div>

      {nextCashflowWin && (
        <div className="border-b border-border p-4">
          <div className="flex items-start gap-3">
            <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-signal" />
            <div className="min-w-0 flex-1">
              <div className="label-xs">Nästa vardagsvinst</div>
              <div className="mt-1 truncate text-15 font-medium">{nextCashflowWin.loan.name}</div>
              <p className="mt-1 text-13 text-muted-foreground">
                Att lösa <span className="num text-foreground">{kr(nextCashflowWin.loan.current_balance)}</span> här tar bort ungefär{" "}
                <span className="num font-medium text-foreground">{kr(nextCashflowWin.monthly)}/mån</span> i nuvarande obligatorisk betalning.
              </p>
              <p className="mt-2 text-[0.7rem] text-muted-foreground">
                Vald för störst månadsutrymme per krona att lösa — inte som generell ränterekommendation.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-2 p-4 sm:grid-cols-2">
        <Link
          to="/onskelista"
          className="flex min-h-11 items-center justify-between rounded-[6px] border border-border px-3 text-13 font-medium transition-colors hover:bg-accent"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-saving" />
            Jag är sugen på att köpa något
          </span>
          <ArrowRight className="size-4" />
        </Link>
        <Link
          to="/plan"
          className="flex min-h-11 items-center justify-between rounded-[6px] border border-border px-3 text-13 font-medium transition-colors hover:bg-accent"
        >
          <span className="flex items-center gap-2">
            <HandCoins className="size-4 text-signal" />
            Planera nästa extraamortering
          </span>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}
