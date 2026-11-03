/**
 * Queue + settings store (ARCHITECTURE §7). The store is the *only* place
 * that creates/revokes object URLs, moves lifecycle statuses, and owns the
 * conversion scheduler handle.
 */
import { create } from "zustand";
import { deriveWarnings, mergeWarnings, type GuardInput } from "../engine/qualityGuard";
import { getFormat, DEFAULT_SETTINGS_FORMAT } from "../engine/registry";
import { buildOutputName } from "../engine/naming";
import { ConversionScheduler, type PendingJob } from "../engine/scheduler";
import type { Dimensions, ImageFormatId, OutputSettings, QueueItem } from "../engine/types";
import { downloadBlob, downloadZip, type ZipEntry } from "../lib/download";
import { createObjectUrl, revokeObjectUrl } from "../lib/thumbnails";
import { newId } from "../lib/utils";
import { validateImageFile } from "../engine/validation";

const DEFAULT_SETTINGS: OutputSettings = {
  format: DEFAULT_SETTINGS_FORMAT, // PNG default per PRD §4 Step 2
  quality: 80,
  resizeEnabled: false,
  maxDimension: 2048,
  suffix: "",
};

interface AppStore {
  items: QueueItem[];
  settings: OutputSettings;
  conversionActive: boolean;
  /** 0..1 overall batch progress; null while idle. */
  conversionOverall: number | null;
  addFiles: (files: File[]) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  updateItem: (id: string, patch: Partial<QueueItem>) => void;
  setDimensions: (id: string, dimensions: Dimensions) => void;
  setOutputFormat: (format: ImageFormatId) => void;
  setQuality: (quality: number) => void;
  setResizeEnabled: (enabled: boolean) => void;
  setMaxDimension: (max: number) => void;
  setSuffix: (suffix: string) => void;
  startConversion: () => void;
  cancelConversion: () => void;
  retryItem: (id: string) => void;
  downloadItem: (id: string) => void;
  downloadAll: () => void;
}

/** Module-level scheduler handle (one batch at a time, PRD §11). */
let activeScheduler: ConversionScheduler | null = null;

export const useAppStore = create<AppStore>((set, get) => ({
  items: [],
  settings: DEFAULT_SETTINGS,
  conversionActive: false,
  conversionOverall: null,

  addFiles(files) {
    if (!files.length) return;

    const created: QueueItem[] = files.map((file) => ({
      id: newId(),
      file,
      name: file.name || "image",
      size: file.size,
      objectUrl: createObjectUrl(file),
      status: "validating",
      detectedFormat: null,
      kindLabel: "File",
      dimensions: null,
      probe: null,
      error: null,
      warnings: [],
      progress: null,
      progressStage: null,
      result: null,
    }));

    set((state) => ({ items: [...state.items, ...created] }));

    for (const item of created) void runValidation(item.id, item.file, set, get);
  },

  removeItem(id) {
    const current = get().items.find((item) => item.id === id);
    if (!current) return;
    revokeObjectUrl(current.objectUrl);
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },

  clearAll() {
    for (const item of get().items) revokeObjectUrl(item.objectUrl);
    set({ items: [] });
  },

  updateItem(id, patch) {
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  },

  setDimensions(id, dimensions) {
    set((state) => ({
      items: state.items.map((item) => (item.id === id && !item.dimensions ? { ...item, dimensions } : item)),
    }));
  },

  setOutputFormat(format) {
    set((state) => {
      // Reset completed items back to ready when format changes so they can be re-converted
      const updatedItems = state.items.map((item) =>
        item.status === "completed" ? { ...item, status: "ready" as const, result: null } : item
      );
      return {
        settings: { ...state.settings, format },
        items: updatedItems,
      };
    });
  },

  setQuality(quality) {
    set((state) => ({ settings: { ...state.settings, quality: clampQuality(quality) } }));
  },

  setResizeEnabled(enabled) {
    set((state) => ({ settings: { ...state.settings, resizeEnabled: enabled } }));
  },

  setMaxDimension(max) {
    set((state) => ({ settings: { ...state.settings, maxDimension: clampMaxDimension(max) } }));
  },

  setSuffix(suffix) {
    set((state) => ({ settings: { ...state.settings, suffix } }));
  },

  startConversion() {
    const state = get();
    if (state.conversionActive || activeScheduler) return;

    const targets = state.items.filter((item) => item.status === "ready" && item.detectedFormat);
    if (targets.length === 0) return;

    const { format, quality, resizeEnabled, maxDimension, suffix } = state.settings;

    // Preflight Quality Guard pass (PRD §7) — suspected facts only.
    for (const item of targets) {
      const input: GuardInput = {
        inputFormat: item.detectedFormat as ImageFormatId,
        outputFormat: format,
        probe: item.probe,
        dimensions: item.dimensions,
        resize: { enabled: resizeEnabled, maxSide: maxDimension },
        confirmedAlpha: null,
      };
      const warnings = deriveWarnings(input);
      if (warnings.length > 0) get().updateItem(item.id, { warnings: mergeWarnings(item.warnings, warnings) });
    }

    const takenNames = new Set<string>();
    const pending: PendingJob[] = targets.map((item) => ({
      id: item.id,
      file: item.file,
      inputFormat: item.detectedFormat as ImageFormatId,
      outputFormat: format,
      quality,
      resizeEnabled,
      maxSide: maxDimension,
      outputName: buildOutputName(item.name, format, suffix, takenNames),
    }));
    const namesById = new Map(pending.map((job) => [job.id, job.outputName]));

    // In-flight progress + success counting feed the overall bar.
    const inflight = new Map<string, number>();
    let doneCount = 0;
    const total = pending.length;
    const recomputeOverall = () => {
      let crossed = 0;
      for (const value of inflight.values()) crossed += value;
      set({ conversionOverall: total > 0 ? Math.min(1, (doneCount + crossed) / total) : 1 });
    };

    const scheduler = new ConversionScheduler({
      onStart: (id) => {
        inflight.set(id, 0.02);
        get().updateItem(id, { status: "processing", progress: 0.02, progressStage: "decoding" });
        recomputeOverall();
      },
      onProgress: (id, stage, value) => {
        inflight.set(id, value);
        get().updateItem(id, { progress: value, progressStage: stage });
        recomputeOverall();
      },
      onWarnings: (id, warnings) => {
        const item = get().items.find((candidate) => candidate.id === id);
        if (!item) return;
        get().updateItem(id, { warnings: mergeWarnings(item.warnings, warnings) });
      },
      onDone: (id, blob) => {
        inflight.delete(id);
        doneCount += 1;
        get().updateItem(id, {
          status: "completed",
          progress: 1,
          result: {
            name: namesById.get(id) ?? "converted",
            size: blob.size,
            mime: blob.type || getFormat(format).mime,
            blob,
          },
        });
        recomputeOverall();
      },
      onFailed: (id, message) => {
        inflight.delete(id);
        doneCount += 1;
        const item = get().items.find((candidate) => candidate.id === id);
        get().updateItem(id, {
          status: "failed",
          progress: null,
          error: {
            code: "conversion-failed",
            kindLabel: item?.kindLabel ?? "File",
            message: `Conversion failed: ${message}`,
          },
        });
        recomputeOverall();
      },
      onIdle: () => {
        inflight.clear();
        // Release the module-level guard so the next batch can start.
        if (activeScheduler === scheduler) activeScheduler = null;
        set({ conversionActive: false, conversionOverall: null });
      },
    });

    activeScheduler = scheduler;
    set({ conversionActive: true, conversionOverall: 0 });
    scheduler.enqueue(pending);
  },

  cancelConversion() {
    if (!activeScheduler) return;
    activeScheduler.cancelAll();
    activeScheduler = null;
    set((state) => ({
      conversionActive: false,
      conversionOverall: null,
      items: state.items.map((item) =>
        item.status === "processing"
          ? { ...item, status: "cancelled", progress: null, progressStage: null }
          : item,
      ),
    }));
  },

  retryItem(id) {
    const item = get().items.find((candidate) => candidate.id === id);
    if (!item || item.status === "processing") return;
    get().updateItem(id, { status: "ready", progress: null, progressStage: null, error: null });
  },

  downloadItem(id) {
    const item = get().items.find((candidate) => candidate.id === id);
    if (!item?.result) return;
    downloadBlob(item.result.blob, item.result.name);
  },

  downloadAll() {
    const completed = get().items.filter((item) => item.status === "completed" && item.result);
    if (completed.length === 0) return;
    if (completed.length === 1) {
      // Single item: download directly (same as individual download)
      downloadBlob(completed[0].result!.blob, completed[0].result!.name);
      return;
    }
    const entries: ZipEntry[] = completed.map((item) => ({
      name: item.result!.name,
      blob: item.result!.blob,
    }));
    void downloadZip(entries);
  },
}));

async function runValidation(
  id: string,
  file: File,
  set: (partial: { items: QueueItem[] }) => void,
  get: () => AppStore,
) {
  const result = await validateImageFile(file);
  const alive = get().items.some((candidate) => candidate.id === id);
  if (!alive) return; // removed while validating

  const patch: Partial<QueueItem> = result.ok
    ? {
        status: "ready",
        detectedFormat: result.format,
        kindLabel: result.kindLabel,
        probe: result.probe,
        error: null,
      }
    : {
        status: "failed",
        detectedFormat: null,
        kindLabel: result.kindLabel,
        probe: null,
        error: { code: result.code, kindLabel: result.kindLabel, message: result.message },
      };

  set({ items: get().items.map((candidate) => (candidate.id === id ? { ...candidate, ...patch } : candidate)) });
}

function clampQuality(value: number): number {
  if (!Number.isFinite(value)) return 80;
  return Math.min(100, Math.max(1, Math.round(value)));
}

function clampMaxDimension(value: number): number {
  if (!Number.isFinite(value)) return 2048;
  return Math.min(10000, Math.max(16, Math.round(value)));
}
