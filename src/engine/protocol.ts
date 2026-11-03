/**
 * Worker protocol — typed envelopes shared by the scheduler (main) and the
 * convert worker (ARCHITECTURE §5.3).
 */
import type { ImageFormatId } from "./types";

export type DecodeStage = "decoding" | "encoding";

export interface ConvertJobMessage {
  type: "convert";
  jobId: string;
  file: File;
  inputFormat: ImageFormatId;
  outputFormat: ImageFormatId;
  quality: number;
  resizeEnabled: boolean;
  maxSide: number;
}

export type WorkerToMainMessage =
  | { type: "job-progress"; jobId: string; stage: DecodeStage; value: number }
  | { type: "job-warnings"; jobId: string; warnings: string[] }
  | { type: "job-done"; jobId: string; blob: Blob }
  | { type: "job-failed"; jobId: string; message: string };
