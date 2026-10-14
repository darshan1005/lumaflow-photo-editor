import { EditDocument, ExportOptions } from '../../../types';

export interface CancellationToken {
  isCancelled: boolean;
  cancel: () => void;
}

export function createCancellationToken(): CancellationToken {
  let cancelled = false;
  return {
    get isCancelled() {
      return cancelled;
    },
    cancel() {
      cancelled = true;
    }
  };
}

export interface FrameMetrics {
  frameId: number;
  renderTimeMs: number;
  gpuTimeMs: number;
  memoryUsageMb: number;
  wasCancelled: boolean;
  timestamp: number;
}

export interface BenchmarkReport {
  engineName: string;
  testIterations: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  fps: number;
  memoryPeakMb: number;
  cancellationEfficiencyPercent: number;
  exportDurationMs: number;
  exportThroughputMpxPerSec: number;
}

export interface IPreviewRenderer {
  initialize(): Promise<void>;
  loadSourceImage(uri: string, maxDimension?: number): Promise<{ width: number; height: number }>;
  renderFrame(document: EditDocument, token?: CancellationToken): Promise<FrameMetrics>;
  getMetrics(): FrameMetrics;
  dispose(): void;
}

export interface IExportRenderer {
  exportImage(
    sourceUri: string,
    document: EditDocument,
    options: ExportOptions,
    token?: CancellationToken
  ): Promise<{ outputUri: string; durationMs: number; outputBytes: number }>;
}

export interface IModularImageEngine {
  readonly name: string;
  readonly previewRenderer: IPreviewRenderer;
  readonly exportRenderer: IExportRenderer;
  runBenchmarks(iterations?: number): Promise<BenchmarkReport>;
}
