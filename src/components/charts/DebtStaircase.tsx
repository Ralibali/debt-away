import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { manad } from "@/lib/format";
import type { PayoffResult } from "@/lib/payoff";
import { ChartFrame, COLORS, MonoTooltip, axisTick, krShort } from "./primitives";

/** Skuldtrappan: staplad yta som krymper mot noll, en markör per slutdatum. */
export function DebtStaircase({ result }: { result: PayoffResult }) {
  const loanIds = result.perLoan.map((p) => p.loanId);
  const names = new Map(result.perLoan.map((p) => [p.loanId, p.name]));

  const data = useMemo(
    () =>
      result.schedule.map((row) => {
        const point: Record<string, string | number> = { date: row.date };
        for (const id of loanIds) point[id] = row.balances[id] ?? 0;
        return point;
      }),
    [result, loanIds],
  );

  const shades = ["var(--debt)", "color-mix(in oklab, var(--debt) 70%, white)",
    "color-mix(in oklab, var(--debt) 50%, white)", "color-mix(in oklab, var(--debt) 35%, white)",
    "color-mix(in oklab, var(--debt) 22%, white)"];

  return (
    <ChartFrame label="Skuldtrappan" question="När är varje enskilt lån borta?" height={240}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -6, right: 8, top: 8, bottom: 0 }}>
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
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <MonoTooltip
                  title={manad(String(label))}
                  rows={payload
                    .filter((p) => Number(p.value) > 0)
                    .map((p) => ({
                      label: names.get(String(p.dataKey)) ?? String(p.dataKey),
                      value: Number(p.value),
                      color: String(p.color),
                    }))}
                />
              );
            }}
          />
          {loanIds.map((id, i) => (
            <Area
              key={id}
              type="stepAfter"
              dataKey={id}
              stackId="debt"
              stroke={shades[i % shades.length]}
              fill={shades[i % shades.length]}
              fillOpacity={0.55}
              strokeWidth={1}
              isAnimationActive={false}
            />
          ))}
          {result.perLoan
            .filter((p) => p.payoffDate)
            .map((p) => (
              <ReferenceLine
                key={p.loanId}
                x={p.payoffDate as string}
                stroke={COLORS.muted}
                strokeDasharray="2 3"
                label={{
                  value: p.name,
                  position: "insideBottomLeft",
                  angle: -90,
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
