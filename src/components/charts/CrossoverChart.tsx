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
import type { CrossoverSeries } from "@/lib/networth";
import { COLORS, MonoTooltip, axisTick, krShort } from "./primitives";

/**
 * Korspunkten: skuld som yta under nollinjen, sparande över.
 * Historik i full opacitet, projektion i 40 % med streckad kant.
 */
export function CrossoverChart({ series }: { series: CrossoverSeries }) {
  const data = useMemo(
    () =>
      series.points.map((p, i) => {
        const hist = i <= series.todayIndex;
        return {
          date: p.date,
          savingHist: hist ? p.saving : null,
          debtHist: hist ? p.debt : null,
          savingProj: !hist || i === series.todayIndex ? p.saving : null,
          debtProj: !hist || i === series.todayIndex ? p.debt : null,
          net: p.net,
        };
      }),
    [series],
  );

  return (
    <div className="chart-draw h-[260px] w-full sm:h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -6, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.line} vertical={false} />
          <XAxis
            dataKey="date"
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: COLORS.line }}
            minTickGap={40}
            tickFormatter={(d: string) => d.slice(2, 7)}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={krShort}
          />
          <Tooltip
            cursor={{ stroke: COLORS.line }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as (typeof data)[number];
              return (
                <MonoTooltip
                  title={manad(String(label))}
                  rows={[
                    {
                      label: "Sparande",
                      value: p.savingHist ?? p.savingProj ?? 0,
                      color: COLORS.saving,
                    },
                    {
                      label: "Skuld",
                      value: p.debtHist ?? p.debtProj ?? 0,
                      color: COLORS.debt,
                    },
                    { label: "Netto", value: p.net },
                  ]}
                />
              );
            }}
          />
          <ReferenceLine y={0} stroke={COLORS.muted} />
          <Area
            type="monotone"
            dataKey="debtProj"
            stroke={COLORS.debt}
            strokeDasharray="4 3"
            fill={COLORS.debt}
            fillOpacity={0.16}
            strokeOpacity={0.4}
            strokeWidth={1.5}
            isAnimationActive={false}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="savingProj"
            stroke={COLORS.saving}
            strokeDasharray="4 3"
            fill={COLORS.saving}
            fillOpacity={0.16}
            strokeOpacity={0.4}
            strokeWidth={1.5}
            isAnimationActive={false}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="debtHist"
            stroke={COLORS.debt}
            fill={COLORS.debt}
            fillOpacity={0.5}
            strokeWidth={2}
            isAnimationActive={false}
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="savingHist"
            stroke={COLORS.saving}
            fill={COLORS.saving}
            fillOpacity={0.5}
            strokeWidth={2}
            isAnimationActive={false}
            connectNulls
          />
          {series.crossoverDate && (
            <ReferenceLine
              x={series.crossoverDate}
              stroke={COLORS.signal}
              strokeWidth={2}
              label={{
                value: manad(series.crossoverDate),
                position: "insideTopRight",
                fill: "var(--signal)",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
