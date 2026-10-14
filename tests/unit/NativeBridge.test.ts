import {
  computeHistogramNative,
  ensureLumaflowJsiInstalled,
  getRustEngineVersion,
  isRustNativeAvailable,
  processRgbaBufferNative
} from '../../src/core/image-engine/native/LumaflowNativeBridge';
import { createNewEditDocument } from '../../src/features/editor/models/EditDocument';

describe('Phase 2: Lumaflow JSI Native Bridge', () => {
  const originalGlobal = global.__lumaflow;

  afterEach(() => {
    global.__lumaflow = originalGlobal;
  });

  test('Gracefully returns false when running in an environment without native JSI', () => {
    global.__lumaflow = undefined;
    expect(isRustNativeAvailable()).toBe(false);
    expect(getRustEngineVersion()).toBeNull();

    const input = new Uint8ClampedArray(16);
    const output = new Uint8ClampedArray(16);
    const doc = createNewEditDocument('test', 'file://test.jpg');

    expect(processRgbaBufferNative(input, output, 2, 2, doc)).toBe(false);
    expect(computeHistogramNative(input)).toBeNull();
  });

  test('Invokes JSI processBuffer with direct ArrayBuffer memory references', () => {
    let calledWithArgs: any = null;

    global.__lumaflow = {
      getVersion: () => '1.0.0-rust-native',
      processBuffer: (inBuf, outBuf, w, h, d) => {
        calledWithArgs = { inBuf, outBuf, w, h, d };
        // Simulate native operation modifying output buffer
        const outView = new Uint8ClampedArray(outBuf);
        outView[0] = 200;
        return true;
      },
      computeHistogram: () => new ArrayBuffer(4096)
    };

    expect(isRustNativeAvailable()).toBe(true);
    expect(getRustEngineVersion()).toBe('1.0.0-rust-native');

    const input = new Uint8ClampedArray(4 * 4 * 4);
    const output = new Uint8ClampedArray(4 * 4 * 4);
    const doc = createNewEditDocument('test', 'file://test.jpg');
    doc.basic.exposure = 1.0;

    const success = processRgbaBufferNative(input, output, 4, 4, doc);
    expect(success).toBe(true);
    expect(calledWithArgs).toBeDefined();
    expect(calledWithArgs.w).toBe(4);
    expect(calledWithArgs.h).toBe(4);
    expect(calledWithArgs.d.basic.exposure).toBe(1.0);
    expect(output[0]).toBe(200);
  });

  test('Unpacks 1024-entry histogram into typed RGBLuma channels', () => {
    global.__lumaflow = {
      getVersion: () => '1.0.0-rust-native',
      processBuffer: () => true,
      computeHistogram: (rgbaBuf) => {
        const buf = new ArrayBuffer(4096);
        const u32 = new Uint32Array(buf);
        u32[100] = 42;      // Red bin 100
        u32[256 + 50] = 88; // Green bin 50
        u32[512 + 200] = 17;// Blue bin 200
        u32[768 + 128] = 99;// Luma bin 128
        return buf;
      }
    };

    const pixels = new Uint8ClampedArray(100);
    const result = computeHistogramNative(pixels);

    expect(result).not.toBeNull();
    if (result) {
      expect(result.red.length).toBe(256);
      expect(result.green.length).toBe(256);
      expect(result.blue.length).toBe(256);
      expect(result.luma.length).toBe(256);

      expect(result.red[100]).toBe(42);
      expect(result.green[50]).toBe(88);
      expect(result.blue[200]).toBe(17);
      expect(result.luma[128]).toBe(99);
    }
  });
});
