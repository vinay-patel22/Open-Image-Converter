import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { useAppStore } from "../../state/store";
import { getFormat } from "../../engine/registry";

/**
 * Advanced options — 2-column layout for better UX
 */
export function AdvancedOptions({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const settings = useAppStore((state) => state.settings);
  const setQuality = useAppStore((state) => state.setQuality);
  const setResizeEnabled = useAppStore((state) => state.setResizeEnabled);
  const setMaxDimension = useAppStore((state) => state.setMaxDimension);
  const setSuffix = useAppStore((state) => state.setSuffix);

  const spec = getFormat(settings.format);
  const qualityApplies = spec.qualityApplicable;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild disabled={disabled}>
        <Button variant="ghost" size="sm" className="gap-1.5 text-sm transition-smooth">
          <SlidersHorizontal aria-hidden className="h-4 w-4" />
          Advanced Options
          <ChevronDown aria-hidden className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 rounded-lg border-2 border-dashed border-border bg-muted/30 p-4">
          <div className="grid grid-cols-2 gap-4">
            {qualityApplies && (
              <section>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">Quality</label>
                  <span className="text-xs font-medium text-muted-foreground">{settings.quality}</span>
                </div>
                <Slider
                  className="mt-2"
                  min={1}
                  max={100}
                  step={1}
                  value={[settings.quality]}
                  disabled={disabled}
                  onValueChange={([value]) => setQuality(value)}
                  aria-label="Quality"
                />
              </section>
            )}

            <section>
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Checkbox
                  checked={settings.resizeEnabled}
                  onCheckedChange={(checked) => setResizeEnabled(checked === true)}
                  disabled={disabled}
                  aria-label="Resize images"
                />
                Resize
              </label>
              {settings.resizeEnabled && (
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    type="number"
                    min={16}
                    max={10000}
                    value={settings.maxDimension}
                    disabled={disabled}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (event.target.value === "") return;
                      setMaxDimension(value);
                    }}
                    aria-label="Maximum dimension"
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">px</span>
                </div>
              )}
            </section>

            <section className="col-span-2">
              <label htmlFor="output-suffix" className="text-sm font-medium text-foreground">
                Suffix
              </label>
              <Input
                id="output-suffix"
                value={settings.suffix}
                onChange={(event) => setSuffix(event.target.value)}
                disabled={disabled}
                maxLength={48}
                placeholder="-web"
                className="mt-2 w-full"
              />
            </section>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
