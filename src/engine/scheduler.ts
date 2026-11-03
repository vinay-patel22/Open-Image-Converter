/**
 * Conversion orchestration (ARCHITECTURE §5.3): saturates a small worker pool
 * with one job per worker at a time; single failures and single cancellations
 * never disturb other jobs. The UI thread receives only typed envelopes.
 */
import type { ConvertJobMessage, DecodeStage, WorkerToMainMessage } from "./protocol";
import type { ImageFormatId } from "./types";

export interface PendingJob {
  id: string;
  file: File;
  inputFormat: ImageFormatId;
  outputFormat: ImageFormatId;
  quality: number;
  resizeEnabled: boolean;
  maxSide: number;
  outputName: string;
}

export interface SchedulerHandlers {
  onStart(jobId: string): void;
  onProgress(jobId: string, stage: DecodeStage, value: number): void;
  onWarnings(jobId: string, warnings: string[]): void;
  onDone(jobId: string, blob: Blob): void;
  onFailed(jobId: string, message: string): void;
  onIdle(): void;
}

/** 1 worker by default; small multicore hosts scale to 3, strong ones to 4. */
export function computePoolSize(): number {
  if (typeof navigator === "undefined") return 1;
  const cores = navigator.hardwareConcurrency || 0;
  if (cores >= 8) return 4;
  if (cores >= 4) return Math.min(3, cores - 1);
  return 1;
}

export class ConversionScheduler {
  private readonly handlers: SchedulerHandlers;
  private readonly maxWorkers: number;
  /** worker → assigned job id, or null when idle. */
  private readonly workers = new Map<Worker, string | null>();
  private queue: PendingJob[] = [];
  /** Becomes true on the first enqueue so the idle check will not fire early. */
  private started = false;
  /** The pool is finished (or cancelled); enqueue on it is inert. */
  private idleNotified = false;

  constructor(handlers: SchedulerHandlers) {
    this.handlers = handlers;
    this.maxWorkers = computePoolSize();
  }

  enqueue(specs: PendingJob[]): void {
    if (this.idleNotified || specs.length === 0) return; // cancelled/completed pools are inert
    this.started = true;
    this.queue.push(...specs);
    this.dispatch();
  }

  /** Terminates the pool. The caller is responsible for item status updates. */
  cancelAll(): void {
    this.queue = [];
    for (const worker of this.workers.keys()) worker.terminate();
    this.workers.clear();
    this.notifyIdle();
  }

  private dispatch(): void {
    for (;;) {
      if (this.queue.length === 0) break;
      let worker = this.idleWorker();
      if (!worker) {
        if (this.workers.size >= this.maxWorkers) return; // saturated; resume on next completion
        worker = this.spawnWorker();
      }
      const job = this.queue.shift() as PendingJob;
      this.workers.set(worker, job.id);
      worker.postMessage({
        type: "convert",
        jobId: job.id,
        file: job.file,
        inputFormat: job.inputFormat,
        outputFormat: job.outputFormat,
        quality: job.quality,
        resizeEnabled: job.resizeEnabled,
        maxSide: job.maxSide,
      } satisfies ConvertJobMessage);
      this.handlers.onStart(job.id);
    }

    // All work drained (or every worker errored out) → retire the pool exactly once.
    if (this.started && this.queue.length === 0 && !this.isBusy()) {
      for (const worker of this.workers.keys()) worker.terminate();
      this.workers.clear();
      this.notifyIdle();
    }
  }

  /** Fires `onIdle` at most once per scheduler lifetime. */
  private notifyIdle(): void {
    if (this.idleNotified) return;
    this.idleNotified = true;
    this.handlers.onIdle();
  }

  private spawnWorker(): Worker {
    const worker = new Worker(new URL("./workers/convert.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => this.onWorkerMessage(worker, event.data);
    worker.onerror = (event) => this.failWorkerByError(worker, event.message || "The worker failed unexpectedly.");
    return worker;
  }

  private onWorkerMessage(worker: Worker, message: WorkerToMainMessage): void {
    const jobId = this.workers.get(worker);
    if (!jobId) return;
    switch (message.type) {
      case "job-progress":
        this.handlers.onProgress(message.jobId, message.stage, message.value);
        break;
      case "job-warnings":
        this.handlers.onWarnings(message.jobId, message.warnings);
        break;
      case "job-done":
        this.handlers.onDone(message.jobId, message.blob);
        this.finishJob(worker);
        break;
      case "job-failed":
        this.handlers.onFailed(message.jobId, message.message);
        this.finishJob(worker);
        break;
    }
  }

  private failWorkerByError(worker: Worker, message: string): void {
    const jobId = this.workers.get(worker);
    if (jobId) {
      this.handlers.onFailed(jobId, message);
      this.workers.set(worker, null);
      worker.terminate();
      this.workers.delete(worker);
      this.dispatch();
    }
  }

  private finishJob(worker: Worker): void {
    this.workers.set(worker, null);
    this.dispatch();
  }

  private idleWorker(): Worker | null {
    for (const [worker, jobId] of this.workers) {
      if (jobId === null) return worker;
    }
    return null;
  }

  private isBusy(): boolean {
    for (const jobId of this.workers.values()) {
      if (jobId !== null) return true;
    }
    return false;
  }
}
