import { RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { datum } from "@/lib/format";

interface Props {
  title: string;
  /** Kort text om vad koden redan räknat ut — visas alltid, även utan AI. */
  subtitle: string;
  hasResult: boolean;
  pending: boolean;
  error: unknown;
  cachedAt?: string | null;
  disabled?: boolean;
  disabledReason?: string;
  onRun: (force: boolean) => void;
  children?: React.ReactNode;
}

/**
 * Gemensamt skal för coachmodulerna. AI körs bara på klick, aldrig automatiskt,
 * och den förklarar enbart siffror som redan är uträknade i koden.
 */
export function CoachPanel({
  title,
  subtitle,
  hasResult,
  pending,
  error,
  cachedAt,
  disabled,
  disabledReason,
  onRun,
  children,
}: Props) {
  return (
    <div className="panel p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button
          size="sm"
          variant={hasResult ? "outline" : "default"}
          disabled={pending || disabled}
          onClick={() => onRun(hasResult)}
        >
          {pending ? (
            <RefreshCw className="size-3.5 animate-spin" />
          ) : hasResult ? (
            "Uppdatera"
          ) : (
            "Analysera"
          )}
        </Button>
      </div>

      {disabled && disabledReason && (
        <p className="mt-2 text-xs text-muted-foreground">{disabledReason}</p>
      )}

      {error != null && (
        <p className="mt-2 text-xs text-destructive">
          {error instanceof Error ? error.message : "Något gick fel."}
        </p>
      )}

      {cachedAt && hasResult && (
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Senaste analys {datum(cachedAt)}. Siffrorna är uträknade i appen — texten är bara
          förklaringen.
        </p>
      )}

      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
