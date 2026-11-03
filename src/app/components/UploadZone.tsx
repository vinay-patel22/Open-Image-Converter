import { useRef, useState, type DragEvent, type KeyboardEvent, type ChangeEvent } from "react";
import { ImagePlus, FolderOpen, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useAppStore } from "../../state/store";
import { cn } from "../../lib/utils";

/**
 * Upload area — Large, prominent when no files, compact when files exist
 */
export function UploadZone({ compact }: { compact: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const addFiles = useAppStore((state) => state.addFiles);

  const start = (fileList: FileList | null) => {
    setLoading(false);
    if (fileList) addFiles(Array.from(fileList));
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    start(event.target.files);
    event.target.value = ""; // allow re-selecting the same file later
  };

  const handleClick = () => {
    setLoading(true);
    inputRef.current?.click();
    setTimeout(() => setLoading(false), 3000);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    start(event.dataTransfer?.files ?? null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  const accept = ".png,.jpg,.jpeg,.webp,.avif,.gif,.bmp,.tiff,.ico,.svg";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload images. Drag and drop, or press Enter to browse."
      onClick={handleClick}
      onKeyDown={onKeyDown}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "cursor-pointer rounded-xl border-2 border-dashed text-center outline-none transition-smooth relative",
        dragging ? "border-primary bg-accent/50" : "border-primary/60 bg-accent/30 hover:border-primary hover:bg-accent/40",
        compact ? "px-4 py-2.5" : "px-8 py-20 sm:px-12 sm:py-24",
      )}
    >
      <input ref={inputRef} type="file" multiple accept={accept} onChange={onChange} className="sr-only" />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-accent/50 rounded-xl z-10">
          <Loader2 className="h-8 w-8 text-primary spinner" />
        </div>
      )}

      {compact ? (
        <div className="flex items-center justify-center gap-2">
          <ImagePlus className="h-4 w-4 text-primary" aria-hidden />
          <p className="text-base text-foreground">
            <span className="font-medium">Drag more images</span> or{" "}
            <span className="font-medium text-primary">browse</span> to add
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/10">
            <ImageIcon className="h-10 w-10 text-primary" aria-hidden />
          </div>
          <div className="space-y-3">
            <p className="text-xl font-medium text-foreground">Drag & drop images here</p>
            <p className="text-sm text-muted-foreground">or</p>
            <Button
              variant="default"
              size="lg"
              className="gap-2 shadow-subtle"
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              <FolderOpen className="h-5 w-5" aria-hidden />
              Choose Images
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            supports png, jpg, webp, avif, gif, bmp, tiff, ico, svg
          </p>
        </div>
      )}
    </div>
  );
}
