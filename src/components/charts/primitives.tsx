import { kr } from "@/lib/format";
import type { ReactNode } from "react";

/** Kort runt ett diagram: etikett, frågan det svarar på, sedan ytan. */
export function ChartFrame({
  label,
  question,
  children,
  height = 220,
  footer,
}: {
  label: string;
  question?: string;
  children: ReactNode;
  height?: number;
  footer?: ReactNode;
}) {
  return (
    <section className="panel p-4">
      <div className="label-xs">{label}</div>
      {question && <p className="mt-1 text-13 text-muted-foreground">{question}</p>}
      <div className="mt-4 w-full" style={{ height }}>
        {children}
      </div>
      {footer && <div className="mt-4 border-t border-border pt-4">{footer}</div>}
    </section>
  );
}

export const axisTick = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
  fontFamily: "var(--font-mono)",
} as const;

export function krShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")} mn`;
  if (abs >= 1000) return `${Math.round(v / 1000)}k`;
  return String(Math.round(v));
}

export interface TipRow {
  label: string;
  value: number;
  color?: string;
}

/** Tooltip: alltid belopp i IBM Plex Mono. */
export function MonoTooltip({
  title,
  rows,
}: {
  title: string;
  rows: TipRow[];
}) {
  return (
    <div className="rounded-[6px] border border-border bg-card px-3 py-2 text-13">
      <div className="mb-1 text-muted-foreground">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between gap-6">
          <span className="flex items-center gap-1.5">
            {r.color && (
              <span
                className="inline-block size-2 rounded-[1px]"
                style={{ background: r.color }}
                aria-hidden
              />
            )}
            {r.label}
          </span>
          <span className="num">{kr(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export const COLORS = {
  debt: "var(--debt)",
  saving: "var(--saving)",
  signal: "var(--signal)",
  line: "var(--border)",
  muted: "var(--muted-foreground)",
} as const;
