import { RustNativeEngine } from './adapters/RustNativeEngine';
import { IImageEngine } from './interfaces/ImageEngine';
import { IModularImageEngine } from './interfaces/ModularImageEngine';
import { isRustNativeAvailable } from './native/LumaflowNativeBridge';

let sharedEngineInstance: (IModularImageEngine & IImageEngine) | null = null;

/**
 * Returns the primary active image processing engine for the current platform.
 * Automatically utilizes the RustNativeEngine (with JSI zero-copy pointer access on mobile
 * and multi-core Rayon execution), with graceful automatic fallback when JSI is unavailable.
 */
export function getActiveImageEngine(): IModularImageEngine & IImageEngine {
  if (!sharedEngineInstance) {
    sharedEngineInstance = new RustNativeEngine();
  }
  return sharedEngineInstance;
}

/**
 * Checks whether the active engine is running natively on compiled Rust.
 */
export function isRunningOnRustCore(): boolean {
  return isRustNativeAvailable();
}
