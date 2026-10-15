import { CpuImageEngine, maskWeight } from '../../src/core/image-engine/adapters/CpuEngine';
import { createNewEditDocument } from '../../src/features/editor/models/EditDocument';
import { PresetManager } from '../../src/features/editor/presets/PresetManager';
import { Preset } from '../../src/types';

describe('editor tool UI integration contracts', () => {
  test('preset application updates the document state used by active controls', () => {
    const document = createNewEditDocument('preset-ui', 'memory://preset-ui');
    const preset: Preset = {
      id: 'ui-preset',
      name: 'UI preset',
      category: 'user',
      createdAt: Date.now(),
      documentState: {
        basic: { ...document.basic, exposure: 1 },
        hslMixer: document.hslMixer.map((channel, index) =>
          index === 0 ? { ...channel, hue: 30 } : { ...channel }
        ) as typeof document.hslMixer
      }
    };

    const updated = new PresetManager([preset]).applyPreset(document, preset);

    expect(updated.appliedPresetId).toBe('ui-preset');
    expect(updated.basic.exposure).toBe(1);
    expect(updated.hslMixer[0].hue).toBe(30);
    expect(document.basic.exposure).toBe(0);
  });

  test('brush mask overlay semantics preserve selective and inverted regions', () => {
    const mask = {
      id: 'brush-ui',
      name: 'Brush UI',
      type: 'brush' as const,
      inverted: false,
      opacity: 50,
      points: [{ x: 0.5, y: 0.5 }],
      exposure: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      highlights: 0,
      shadows: 0
    };

    expect(maskWeight(mask, 0.5, 0.5)).toBeCloseTo(0.5);
    expect(maskWeight(mask, 0.05, 0.05)).toBe(0);
    expect(maskWeight({ ...mask, inverted: true }, 0.05, 0.05)).toBeCloseTo(0.5);
  });

  test('mixer changes are selective instead of recoloring neutral pixels', () => {
    const document = createNewEditDocument('mixer-ui', 'memory://mixer-ui');
    document.hslMixer[0].hue = 60;
    document.hslMixer[0].saturation = 100;
    const source = new Uint8ClampedArray([
      128, 128, 128, 255,
      255, 0, 0, 255,
      0, 0, 255, 255
    ]);
    const output = new CpuImageEngine().processPixelBuffer(source, 3, 1, document);

    expect(Array.from(output.slice(0, 3))).toEqual([128, 128, 128]);
    expect(output[4 + 1]).toBeGreaterThan(0);
    expect(Array.from(output.slice(8, 11))).toEqual([0, 0, 255]);
  });
});
