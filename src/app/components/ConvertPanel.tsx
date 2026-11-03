import { useAppStore } from "../../state/store";
import { AdvancedOptions } from "./AdvancedOptions";
import { FormatSelector } from "./FormatSelector";
import { Button } from "./ui/button";

/**
 * Conversion controls — Minimal, clean design with proper alignment
 */
export function ConvertPanel() {
  const readyCount = useAppStore((state) => state.items.filter((item) => item.status === "ready").length);
  const conversionActive = useAppStore((state) => state.conversionActive);
  const conversionOverall = useAppStore((state) => state.conversionOverall);
  const startConversion = useAppStore((state) => state.startConversion);
  const cancelConversion = useAppStore((state) => state.cancelConversion);

  const percent = conversionOverall === null ? 0 : Math.round(conversionOverall * 100);

  return (
    <section aria-label="Conversion controls" className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-subtle flex-shrink-0">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1">
          <p className="mb-1.5 text-sm font-medium text-foreground">Convert to</p>
          <FormatSelector disabled={conversionActive} />
        </div>
        <div className="flex flex-shrink-0 flex-col items-start gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
          <AdvancedOptions disabled={conversionActive} />
          {conversionActive ? (
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Overall conversion progress"
                className="h-2 w-36 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full bg-primary transition-all duration-300 ease-out" style={{ width: `${percent}%` }} />
              </div>
              <span className="w-10 text-right text-sm text-muted-foreground tabular-nums">{percent}%</span>
              <Button variant="outline" size="sm" className="text-destructive transition-smooth" onClick={cancelConversion}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button size="lg" className="rounded-lg shadow-subtle transition-smooth" disabled={readyCount === 0} onClick={startConversion}>
              Convert All
              {readyCount > 0 && (
                <span className="ml-1.5 rounded bg-white/20 px-2 py-0.5 text-xs" aria-hidden>
                  {readyCount}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
