import { kr } from "@/lib/format";
import type { IskResult } from "@/lib/isk";

/** Fribeloppsmätaren: en enkel horisontell bar mot fribeloppsgränsen. */
export function FribeloppMeter({ result }: { result: IskResult }) {
  const { constants, kapitalunderlag } = result;
  const pct = Math.min(100, (kapitalunderlag / constants.fribelopp) * 100);
  const over = kapitalunderlag > constants.fribelopp;

  return (
    <section className="panel p-4">
      <div className="label-xs">Fribeloppsmätaren</div>
      <p className="mt-1 text-13 text-muted-foreground">
        Hur nära skattegränsen på ISK och kapitalförsäkring ligger jag?
      </p>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="num text-24">{kr(kapitalunderlag)}</span>
          <span className="num text-13 text-muted-foreground">
            av {kr(constants.fribelopp)}
          </span>
        </div>
        <div
          className="mt-2 h-3 w-full border border-border bg-background"
          role="img"
          aria-label={`Kapitalunderlag ${kr(kapitalunderlag)} av fribeloppet ${kr(constants.fribelopp)}`}
        >
          <div
            className="h-full"
            style={{
              width: `${pct}%`,
              background: over ? "var(--debt)" : "var(--saving)",
              transition: "width 400ms ease-out",
            }}
          />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
        <div>
          <dt className="label-xs">
            {over ? "Över fribeloppet" : "Kvar till gränsen"}
          </dt>
          <dd className="num mt-1 text-18">
            {kr(over ? result.overFribelopp : result.toFribelopp)}
          </dd>
        </div>
        <div>
          <dt className="label-xs">Skatt {result.year}</dt>
          <dd className="num mt-1 text-18">{kr(result.tax)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-13 text-muted-foreground">
        {result.taxFree
          ? `Under ${kr(constants.fribelopp)} betalar du ingen schablonskatt alls.`
          : `Schablonränta ${(constants.schablonranta * 100)
              .toFixed(2)
              .replace(".", ",")} % och kapitalskatt ${constants.kapitalskatt * 100} % på beloppet över fribeloppet.`}{" "}
        Kapitalunderlaget bygger på {result.measuredQuarters} av 4 mätdagar hittills i år.
      </p>
    </section>
  );
}
