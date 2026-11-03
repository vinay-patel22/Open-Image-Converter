import { Download, Trash2 } from "lucide-react";
import { useAppStore } from "../../state/store";
import { QueueItem as QueueItemRow } from "./QueueItem";

/** File queue — Refined, professional design with scrollable list */
export function FileQueue() {
  const items = useAppStore((state) => state.items);
  const clearAll = useAppStore((state) => state.clearAll);
  const downloadAll = useAppStore((state) => state.downloadAll);

  const completedCount = items.filter((item) => item.status === "completed").length;
  const hasCompleted = completedCount > 0;

  return (
    <section aria-labelledby="queue-title" className="rounded-xl border border-border bg-card shadow-subtle flex flex-col min-h-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5 flex-shrink-0">
        <h2 id="queue-title" className="text-sm font-medium text-foreground">
          Images <span className="text-muted-foreground">({items.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          {hasCompleted && (
            <button
              type="button"
              onClick={downloadAll}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-foreground transition-smooth hover:bg-muted focus-visible:outline-none"
            >
              <Download aria-hidden className="h-3.5 w-3.5" />
              Download All
            </button>
          )}
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:bg-muted focus-visible:outline-none"
          >
            <Trash2 aria-hidden className="h-3.5 w-3.5" />
            Clear all
          </button>
        </div>
      </div>
      <ul className="divide-y divide-border overflow-y-auto flex-1">
        {items.map((item) => (
          <QueueItemRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}
