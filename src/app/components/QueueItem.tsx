import type { ChangeEvent } from "react";
import { FileImage, RotateCcw, X, Loader2 } from "lucide-react";
import type { QueueItem } from "../../engine/types";
import { Badge } from "./ui/badge";
import { useAppStore } from "../../state/store";
import { formatBytes } from "../../lib/formatBytes";

/** Queue row — Refined design with clean layout and proper states */
export function QueueItem({ item }: { item: QueueItem }) {
  const removeItem = useAppStore((state) => state.removeItem);
  const downloadItem = useAppStore((state) => state.downloadItem);
  const retryItem = useAppStore((state) => state.retryItem);
  const updateItem = useAppStore((state) => state.updateItem);

  const onImageLoad = (event: ChangeEvent<HTMLImageElement>) => {
    const image = event.target as HTMLImageElement;
    const { naturalWidth, naturalHeight } = image;
    if (naturalWidth > 0) updateItem(item.id, { dimensions: { width: naturalWidth, height: naturalHeight } });
  };

  const canRemove = item.status !== "processing";

  return (
    <li className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted sm:h-12 sm:w-12">
        {item.objectUrl ? (
          <img
            src={item.objectUrl}
            alt=""
            loading="lazy"
            decoding="async"
            aria-hidden
            onLoad={onImageLoad}
            onError={(event) => {
              (event.target as HTMLImageElement).style.display = "none";
            }}
            className="h-full w-full object-contain"
          />
        ) : (
          <FileImage className="h-4.5 w-4.5 text-muted-foreground" aria-hidden />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground" title={item.name}>
          {item.name}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.dimensions ? `${item.dimensions.width} × ${item.dimensions.height}` : "—"} · {formatBytes(item.size)} ·{" "}
          {item.kindLabel}
        </p>

        {item.warnings.length > 0 && (
          <p className="mt-1.5 truncate text-xs text-warning-foreground" title={item.warnings.join(" · ")}>
            {item.warnings.join(" · ")}
          </p>
        )}

        {item.error && <p className="mt-1.5 truncate text-xs text-destructive">{item.error.message}</p>}

        {item.status === "completed" && item.result && (
          <p className="mt-1.5 flex items-center gap-2 text-xs text-success">
            <span>{item.result.name} · {formatBytes(item.result.size)}</span>
            <button
              type="button"
              onClick={() => downloadItem(item.id)}
              aria-label={`Download ${item.result.name}`}
              className="rounded px-2 py-1 font-medium text-primary underline-offset-2 hover:bg-accent hover:underline focus-visible:outline-none"
            >
              Download
            </button>
          </p>
        )}

        {item.status === "processing" && item.progress !== null && (
          <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground" aria-hidden>
            <Loader2 className="h-3 w-3 spinner" />
            {item.progressStage === "encoding" ? "Encoding" : "Decoding"} · {Math.round(item.progress * 100)}%
          </p>
        )}

        {item.status === "cancelled" && (
          <button
            type="button"
            onClick={() => retryItem(item.id)}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-smooth hover:bg-accent focus-visible:outline-none"
          >
            <RotateCcw aria-hidden className="h-3 w-3" />
            Return to queue
          </button>
        )}

        {item.status === "failed" && item.error?.code === "conversion-failed" && (
          <button
            type="button"
            onClick={() => retryItem(item.id)}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-smooth hover:bg-accent focus-visible:outline-none"
          >
            <RotateCcw aria-hidden className="h-3 w-3" />
            Retry
          </button>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <StatusBadge item={item} />
        <button
          type="button"
          onClick={() => removeItem(item.id)}
          disabled={!canRemove}
          aria-label={`Remove ${item.name} from the queue`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

function StatusBadge({ item }: { item: QueueItem }) {
  switch (item.status) {
    case "validating":
      return <Badge variant="secondary" className="text-xs">Checking…</Badge>;
    case "ready":
      return (
        <Badge variant="outline" className="text-xs text-success border-success/30">
          Ready
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="default" className="text-xs">
          {item.progressStage === "encoding" ? "Encoding" : "Decoding"}
        </Badge>
      );
    case "completed":
      return <Badge variant="success" className="text-xs">Done</Badge>;
    case "failed":
      return <Badge variant="destructive" className="text-xs">{item.error?.code === "conversion-failed" ? "Failed" : "Unsupported"}</Badge>;
    case "cancelled":
      return <Badge variant="secondary" className="text-xs">Cancelled</Badge>;
  }
}
