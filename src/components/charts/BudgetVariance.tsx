import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { kr } from "@/lib/format";
import { ChartFrame, COLORS, MonoTooltip, axisTick, krShort } from "./primitives";

export interface VarianceLine {
  name: string;
  planned: number;
  actual: number;
}

/**
 * Budgetavvikelse: horisontella staplar som avviker från det planerade,
 * inte från noll. Negativt = över plan.
 */
export function BudgetVariance({ lines }: { lines: VarianceLine[] }) {
  const data = lines
    .filter((l) => l.planned > 0 || l.actual > 0)
    .map((l) => ({ name: l.name, avvikelse: Math.round(l.planned - l.actual), planned: l.planned, actual: l.actual }))
    .sort((a, b) => a.avvikelse - b.avvikelse)
    .slice(0, 10);

  if (data.length === 0) {
    return (
      <ChartFrame label="Budgetavvikelse" question="Var spräckte jag?" height={80}>
        <p className="text-13 text-muted-foreground">
          Ingen budget satt för månaden. Lägg in planerade belopp per kategori så visas
          avvikelsen här.
        </p>
      </ChartFrame>
    );
  }

  return (
    <ChartFrame label="Budgetavvikelse" question="Var spräckte jag?" height={Math.max(160, data.length * 30)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
          <CartesianGrid stroke={COLORS.line} horizontal={false} />
          <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={krShort} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            tickLine={false}
            axisLine={false}
            width={104}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0]?.payload as (typeof data)[number];
              return (
                <MonoTooltip
                  title={p.name}
                  rows={[
                    { label: "Planerat", value: p.planned },
                    { label: "Faktiskt", value: p.actual },
                    { label: "Avvikelse", value: p.avvikelse },
                  ]}
                />
              );
            }}
          />
          <ReferenceLine x={0} stroke={COLORS.muted} />
          <Bar dataKey="avvikelse" isAnimationActive={false} barSize={14}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.avvikelse < 0 ? COLORS.debt : COLORS.saving} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function varianceSummary(lines: VarianceLine[]): string {
  const worst = [...lines].sort((a, b) => a.planned - a.actual - (b.planned - b.actual))[0];
  if (!worst) return "";
  const diff = worst.planned - worst.actual;
  return diff < 0
    ? `Störst avvikelse: ${worst.name}, ${kr(Math.abs(diff))} över plan.`
    : "Ingen kategori ligger över plan den här månaden.";
}
