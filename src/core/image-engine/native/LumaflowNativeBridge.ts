import { EditDocument } from '../../../types';

export interface NativeHistogramResult {
  red: Uint32Array;
  green: Uint32Array;
  blue: Uint32Array;
  luma: Uint32Array;
}

export interface TileBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ILumaflowGlobalJSI {
  getVersion(): string;
  processBuffer(
    inputBuffer: ArrayBuffer,
    outputBuffer: ArrayBuffer,
    width: number,
    height: number,
    doc: EditDocument
  ): boolean;
  computeHistogram(rgbaBuffer: ArrayBuffer): ArrayBuffer;
  calculateTiles?(width: number, height: number, tileSize?: number): TileBounds[];
}

declare global {
  var __lumaflow: ILumaflowGlobalJSI | undefined;
}

// Graceful dynamic resolution for React Native native modules
function getNativeModules(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native');
    return rn.NativeModules;
  } catch {
    return null;
  }
}

function getPlatformOS(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rn = require('react-native');
    return rn.Platform?.OS ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Initializes and installs the Lumaflow JSI bindings on the JavaScript runtime.
 */
export function ensureLumaflowJsiInstalled(): boolean {
  if (typeof global.__lumaflow !== 'undefined') {
    return true;
  }

  const os = getPlatformOS();
  if (os === 'android' || os === 'ios') {
    const modules = getNativeModules();
    const jsiModule = modules?.LumaflowJsiModule;
    if (jsiModule && typeof jsiModule.install === 'function') {
      try {
        const success = jsiModule.install();
        return success && typeof global.__lumaflow !== 'undefined';
      } catch (err) {
        console.warn('[LumaflowNativeBridge] JSI installation failed:', err);
        return false;
      }
    }
  }

  return false;
}

/**
 * Checks whether the compiled Rust Native JSI engine is active in the current session.
 */
export function isRustNativeAvailable(): boolean {
  return ensureLumaflowJsiInstalled();
}

/**
 * Returns the version string of the compiled Rust engine.
 */
export function getRustEngineVersion(): string | null {
  if (!ensureLumaflowJsiInstalled()) return null;
  try {
    return global.__lumaflow?.getVersion() ?? null;
  } catch {
    return null;
  }
}

/**
 * Dispatches an RGBA pixel buffer to the Rust core engine via zero-copy JSI pointer sharing.
 */
export function processRgbaBufferNative(
  input: Uint8ClampedArray,
  output: Uint8ClampedArray,
  width: number,
  height: number,
  doc: EditDocument
): boolean {
  if (!ensureLumaflowJsiInstalled() || !global.__lumaflow) {
    return false;
  }

  try {
    return global.__lumaflow.processBuffer(input.buffer as ArrayBuffer, output.buffer as ArrayBuffer, width, height, doc);
  } catch (err) {
    console.error('[LumaflowNativeBridge] Native processBuffer failed:', err);
    return false;
  }
}

/**
 * Computes a 256-bin real-time histogram using Rust multi-core Rayon execution.
 */
export function computeHistogramNative(pixels: Uint8ClampedArray): NativeHistogramResult | null {
  if (!ensureLumaflowJsiInstalled() || !global.__lumaflow) {
    return null;
  }

  try {
    const rawBuffer = global.__lumaflow.computeHistogram(pixels.buffer as ArrayBuffer);
    const u32Array = new Uint32Array(rawBuffer);

    return {
      red: u32Array.subarray(0, 256),
      green: u32Array.subarray(256, 512),
      blue: u32Array.subarray(512, 768),
      luma: u32Array.subarray(768, 1024),
    };
  } catch (err) {
    console.error('[LumaflowNativeBridge] Native computeHistogram failed:', err);
    return null;
  }
}

/**
 * Calculates tile boundaries for memory-bounded high-resolution (48MP) exports.
 */
export function calculateTilesNative(
  fullWidth: number,
  fullHeight: number,
  tileSize: number = 2048
): TileBounds[] {
  if (ensureLumaflowJsiInstalled() && global.__lumaflow && typeof global.__lumaflow.calculateTiles === 'function') {
    try {
      return global.__lumaflow.calculateTiles(fullWidth, fullHeight, tileSize);
    } catch (err) {
      console.warn('[LumaflowNativeBridge] Native calculateTiles failed, falling back:', err);
    }
  }

  // Graceful JavaScript fallback calculation
  const tiles: TileBounds[] = [];
  let y = 0;
  while (y < fullHeight) {
    const tileH = Math.min(tileSize, fullHeight - y);
    let x = 0;
    while (x < fullWidth) {
      const tileW = Math.min(tileSize, fullWidth - x);
      tiles.push({ x, y, width: tileW, height: tileH });
      x += tileSize;
    }
    y += tileSize;
  }
  return tiles;
}
