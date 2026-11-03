/**
 * Convert worker — one job per "convert" message, sequential per worker.
 * Pipeline: decode → (resize) → transparency guard → encode. All heavy CPU
 * lives here; the main thread only paints UI state.
 */
import { decodeToImageData } from "../codecs/decoders";
import { encodeImageData } from "../codecs/encoders";
import { fittedDimensions, flattenAlpha, resizeImageData, scanAlpha } from "../codecs/imageUtils";
import { getFormat } from "../registry";
import type { ConvertJobMessage, WorkerToMainMessage } from "../protocol";

const workerContext = self as unknown as {
  postMessage(message: WorkerToMainMessage): void;
  addEventListener(type: "message", listener: (event: MessageEvent<ConvertJobMessage>) => void): void;
};

workerContext.addEventListener("message", (event) => {
  const job = event.data;
  if (!job || job.type !== "convert") return;
  void processConvertJob(job);
});

export async function processConvertJob(job: ConvertJobMessage): Promise<void> {
  const post = (message: WorkerToMainMessage) => workerContext.postMessage(message);
  try {
    post({ type: "job-progress", jobId: job.jobId, stage: "decoding", value: 0.02 });
    const decoded = await decodeToImageData(job.file, job.inputFormat);
    post({ type: "job-progress", jobId: job.jobId, stage: "decoding", value: 0.45 });

    let working = decoded;
    if (job.resizeEnabled) {
      const target = fittedDimensions(working.width, working.height, job.maxSide);
      if (target.width !== working.width || target.height !== working.height) {
        working = resizeImageData(working, target.width, target.height);
      }
    }

    const outSpec = getFormat(job.outputFormat);
    if (!outSpec.transparency && scanAlpha(working.data)) {
      // flattenAlpha composites IN PLACE onto opaque white; never silent — the
      // store merges this confirmed warning into the item's preflight list.
      flattenAlpha(working);
      post({
        type: "job-warnings",
        jobId: job.jobId,
        warnings: [
          `Transparency was removed: ${outSpec.label} does not support it — transparent areas were filled with white.`,
        ],
      });
    }

    post({ type: "job-progress", jobId: job.jobId, stage: "encoding", value: 0.55 });
    const blob = await encodeImageData(working, job.outputFormat, job.quality);
    post({ type: "job-progress", jobId: job.jobId, stage: "encoding", value: 1 });
    post({ type: "job-done", jobId: job.jobId, blob });
  } catch (error) {
    post({
      type: "job-failed",
      jobId: job.jobId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
