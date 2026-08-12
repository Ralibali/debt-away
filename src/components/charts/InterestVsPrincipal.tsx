import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { kr, manad } from "@/lib/format";
import type { PayoffResult } from "@/lib/payoff";
import { ChartFrame, COLORS, MonoTooltip, axisTick, krShort } from "./primitives";

/**
 * Ränta vs amortering per månad. Vändpunkten — första månaden då mer går
 * till skulden än till banken — markeras.
 */
export function InterestVsPrincipal({ result }: { result: PayoffResult }) {
  const data = useMemo(
    () =>
      result.schedule.slice(0, 60).map((r) => ({
        date: r.date,
        ranta: Math.round(r.interestPaid),
        amortering: Math.round(r.principalPaid),
      })),
    [result],
  );

  const turn = data.find((d) => d.amortering > d.ranta);
  const totalInterest = data.reduce((s, d) => s + d.ranta, 0);

  return (
    <ChartFrame
      label="Ränta vs amortering"
      question="Går mina pengar till skulden eller till banken?"
      height={220}
      footer={
        <p className="text-13 text-muted-foreground">
          {turn
            ? `Från ${manad(turn.date)} går mer till skulden än till räntan.`
            : "Räntan tar fortfarande största delen av varje betalning under hela perioden."}{" "}
          Ränta de fem första åren: <span className="num">{kr(totalInterest)}</span>.
        </p>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -6, right: 8, top: 8, bottom: 0 }} barCategoryGap={1}>
          <CartesianGrid stroke={COLORS.line} vertical={false} />
          <XAxis
            dataKey="date"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: COLORS.line }}
            minTickGap={40}
            tickFormatter={(d: string) => String(d).slice(2, 7)}
          />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickFormatter={krShort} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <MonoTooltip
                  title={manad(String(label))}
                  rows={[
                    {
                      label: "Ränta",
                      value: Number(payload.find((p) => p.dataKey === "ranta")?.value ?? 0),
                      color: COLORS.debt,
                    },
                    {
                      label: "Amortering",
                      value: Number(payload.find((p) => p.dataKey === "amortering")?.value ?? 0),
                      color: COLORS.saving,
                    },
                  ]}
                />
              ) : null
            }
          />
          <Bar dataKey="ranta" stackId="p" fill={COLORS.debt} isAnimationActive={false} />
          <Bar dataKey="amortering" stackId="p" fill={COLORS.saving} isAnimationActive={false} />
          {turn && (
            <ReferenceLine
              x={turn.date}
              stroke={COLORS.muted}
              strokeDasharray="3 3"
              label={{
                value: "vändpunkt",
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
