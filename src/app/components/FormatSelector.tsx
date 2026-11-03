import { useAppStore } from "../../state/store";
import { getFormat, OUTPUT_FORMATS } from "../../engine/registry";
import { cn } from "../../lib/utils";

/**
 * Output format chips — Refined pill design with clean states
 */
export function FormatSelector({ disabled = false }: { disabled?: boolean }) {
  const format = useAppStore((state) => state.settings.format);
  const setOutputFormat = useAppStore((state) => state.setOutputFormat);
  const isJpeg = useAppStore((state) => state.settings.format === "jpeg");
  const isGif = useAppStore((state) => state.settings.format === "gif");
  const isSvg = useAppStore((state) => state.settings.format === "svg");

  return (
    <div>
      <div role="radiogroup" aria-label="Output format" className="flex flex-wrap gap-2">
        {OUTPUT_FORMATS.map((id) => {
          const spec = getFormat(id);
          const selected = format === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => setOutputFormat(id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-smooth",
                "focus-visible:outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                selected
                  ? "border-primary bg-primary text-primary-foreground shadow-subtle"
                  : "border-border bg-white text-foreground hover:border-primary/60 hover:bg-muted/50",
              )}
            >
              {spec.label}
            </button>
          );
        })}
      </div>
      {isJpeg && (
        <p className="mt-2 text-xs text-warning-foreground" id="jpeg-hint">
          JPG does not support transparency — transparent areas will be filled with white.
        </p>
      )}
      {isGif && (
        <p className="mt-2 text-xs text-warning-foreground" id="gif-hint">
          GIF is limited to 256 colours and may reduce image quality.
        </p>
      )}
      {isSvg && (
        <p className="mt-2 text-xs text-warning-foreground" id="svg-hint">
          SVG is rasterized; vector information is lost.
        </p>
      )}
    </div>
  );
}
