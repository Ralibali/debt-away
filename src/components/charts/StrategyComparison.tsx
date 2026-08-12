import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { manad } from "@/lib/format";
import type { ComparisonResult } from "@/lib/payoff";
import { ChartFrame, COLORS, MonoTooltip, axisTick, krShort } from "./primitives";

const SERIES = [
  { key: "avalanche", label: "Lavin", color: "var(--debt)" },
  { key: "snowball", label: "Snöboll", color: "var(--saving)" },
  { key: "hybrid", label: "Hybrid", color: "var(--muted-foreground)" },
] as const;

/** Tre linjer, samma axel. Serierna namnges vid linjen, ingen legend. */
export function StrategyComparison({ result }: { result: ComparisonResult }) {
  const data = useMemo(() => {
    const len = Math.max(
      result.avalanche.schedule.length,
      result.snowball.schedule.length,
      result.hybrid.schedule.length,
    );
    return Array.from({ length: len }, (_, i) => ({
      date:
        result.avalanche.schedule[i]?.date ??
        result.snowball.schedule[i]?.date ??
        result.hybrid.schedule[i]?.date ??
        "",
      avalanche: result.avalanche.schedule[i]?.totalBalance ?? 0,
      snowball: result.snowball.schedule[i]?.totalBalance ?? 0,
      hybrid: result.hybrid.schedule[i]?.totalBalance ?? 0,
    }));
  }, [result]);

  return (
    <ChartFrame
      label="Strategijämförelse"
      question="Vilken strategi ger vad?"
      height={240}
      footer={
        <dl className="grid grid-cols-3 gap-4">
          {SERIES.map((s) => {
            const r = result[s.key];
            return (
              <div key={s.key}>
                <dt className="label-xs" style={{ color: s.color }}>
                  {s.label}
                </dt>
                <dd className="num mt-1 text-15">
                  {r.months != null ? `${r.months} mån` : "–"}
                </dd>
                <dd className="num text-13 text-muted-foreground">
                  {manad(r.debtFreeDate)}
                </dd>
              </div>
            );
          })}
        </dl>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -6, right: 8, top: 8, bottom: 0 }}>
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
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <MonoTooltip
                  title={manad(String(label))}
                  rows={SERIES.map((s) => ({
                    label: s.label,
                    value: Number(
                      payload.find((p) => p.dataKey === s.key)?.value ?? 0,
                    ),
                    color: s.color,
                  }))}
                />
              ) : null
            }
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={s.key === "hybrid" ? 1.25 : 2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
