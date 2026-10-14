import { CpuImageEngine } from '../../src/core/image-engine/adapters/CpuEngine';
import { HistoryManager } from '../../src/features/editor/history/HistoryManager';
import {
  createNewEditDocument,
  validateEditDocument
} from '../../src/features/editor/models/EditDocument';
import { PresetManager } from '../../src/features/editor/presets/PresetManager';

describe('Milestone 1: Image Processing Engine Proof of Concept (PoC)', () => {
  let engine: CpuImageEngine;

  beforeEach(() => {
    engine = new CpuImageEngine();
  });

  test('PoC Test 1: Neutral document preserves image pixels within rounding bounds', () => {
    const doc = createNewEditDocument('test_asset_1', 'file://sample.jpg');
    expect(validateEditDocument(doc)).toBe(true);

    // Create a 4x4 test pixel buffer (RGBA) with middle gray
    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 128;     // R
      pixels[i + 1] = 128; // G
      pixels[i + 2] = 128; // B
      pixels[i + 3] = 255; // A
    }

    const processed = engine.processPixelBuffer(pixels, 4, 4, doc);

    expect(processed.length).toBe(pixels.length);
    // Middle gray with 0 exposure, contrast, WB should remain ~128 (+/- 2 rounding)
    expect(Math.abs(processed[0] - 128)).toBeLessThanOrEqual(2);
    expect(Math.abs(processed[1] - 128)).toBeLessThanOrEqual(2);
    expect(Math.abs(processed[2] - 128)).toBeLessThanOrEqual(2);
    expect(processed[3]).toBe(255);
  });

  test('PoC Test 2: Real exposure adjustment modifies pixels radiometrically', () => {
    const docPlus1EV = createNewEditDocument('test_asset_1', 'file://sample.jpg');
    docPlus1EV.basic.exposure = 1.0; // +1 Stop (2x radiometric energy)

    const docMinus1EV = createNewEditDocument('test_asset_1', 'file://sample.jpg');
    docMinus1EV.basic.exposure = -1.0; // -1 Stop (0.5x radiometric energy)

    const inputPixels = new Uint8ClampedArray([128, 128, 128, 255]);

    const resultPlus = engine.processPixelBuffer(inputPixels, 1, 1, docPlus1EV);
    const resultMinus = engine.processPixelBuffer(inputPixels, 1, 1, docMinus1EV);

    // +1 EV must be significantly brighter than 128
    expect(resultPlus[0]).toBeGreaterThan(170);
    expect(resultPlus[1]).toBeGreaterThan(170);
    expect(resultPlus[2]).toBeGreaterThan(170);

    // -1 EV must be significantly darker than 128
    expect(resultMinus[0]).toBeLessThan(95);
    expect(resultMinus[1]).toBeLessThan(95);
    expect(resultMinus[2]).toBeLessThan(95);

    // Verifies actual pixel alteration occurred
    expect(resultPlus[0]).not.toBe(inputPixels[0]);
    expect(resultMinus[0]).not.toBe(inputPixels[0]);
  });

  test('PoC Test 3: Multi-parameter color balancing modifies chromaticity', () => {
    const docWarm = createNewEditDocument('test_asset_1', 'file://sample.jpg');
    docWarm.basic.temperature = 40; // Warm amber shift
    docWarm.basic.saturation = 20;

    const inputPixels = new Uint8ClampedArray([128, 128, 128, 255]);
    const processed = engine.processPixelBuffer(inputPixels, 1, 1, docWarm);

    // Warmer image must increase Red channel and decrease Blue channel
    expect(processed[0]).toBeGreaterThan(128); // Red boosted
    expect(processed[2]).toBeLessThan(128);    // Blue attenuated
  });

  test('PoC Test 4: Export pipeline returns valid processed file reference', async () => {
    const doc = createNewEditDocument('test_asset_1', 'file://sample.jpg');
    doc.basic.exposure = 0.5;

    const exportedUri = await engine.exportFullResolution('file://sample.jpg', doc, {
      format: 'jpeg',
      quality: 0.95,
      scale: 1.0
    });

    expect(exportedUri).toBeDefined();
    expect(exportedUri).toContain('.jpeg');
  });

  test('PoC Test 5: History Manager supports non-destructive undo/redo cycles', () => {
    const history = new HistoryManager(10);
    const doc0 = createNewEditDocument('test', 'file://sample.jpg');
    doc0.basic.exposure = 0.0;

    // Push initial
    history.push(doc0);

    // Make edit
    const doc1 = createNewEditDocument('test', 'file://sample.jpg');
    doc1.basic.exposure = 0.75;
    history.push(doc1);

    expect(history.canUndo()).toBe(true);

    // Undo to doc0
    const undone = history.undo(doc1);
    expect(undone).not.toBeNull();
    expect(undone?.basic.exposure).toBe(0.75); // previous on stack

    expect(history.canRedo()).toBe(true);
  });

  test('PoC Test 6: Preset Manager applies versioned settings deterministically', () => {
    const presetMgr = new PresetManager();
    const presets = presetMgr.getAllPresets();
    expect(presets.length).toBeGreaterThan(0);

    const doc = createNewEditDocument('test', 'file://sample.jpg');
    const vividPreset = presetMgr.getPresetById('preset_vivid_nature');
    expect(vividPreset).toBeDefined();

    if (vividPreset) {
      const applied = presetMgr.applyPreset(doc, vividPreset);
      expect(applied.appliedPresetId).toBe('preset_vivid_nature');
      expect(applied.basic.vibrance).toBe(25);
      expect(applied.basic.saturation).toBe(10);
    }
  });
});
