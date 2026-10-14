import { EditDocument, ExportOptions } from '../../../types';

export interface RenderResult {
  width: number;
  height: number;
  renderTimeMs: number;
  uri?: string;
}

export interface EngineMetrics {
  fps: number;
  averageRenderTimeMs: number;
  lastFrameGpuTimeMs: number;
}

export interface IImageEngine {
  initialize(): Promise<void>;
  loadImage(uri: string): Promise<{ width: number; height: number }>;
  processPixelBuffer(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    document: EditDocument
  ): Uint8ClampedArray;
  exportFullResolution(
    sourceUri: string,
    document: EditDocument,
    options: ExportOptions
  ): Promise<string>;
  dispose(): void;
}
