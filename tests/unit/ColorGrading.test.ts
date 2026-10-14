import { generateColorGradingTables } from '../../src/core/image-engine/ColorGradingEngine';
import { ColorGradingAdjustments } from '../../src/types';

describe('3-Way Color Grading Tonal Isolation Tests', () => {
  const neutralGrading: ColorGradingAdjustments = {
    shadows: { hue: 0, saturation: 0, luminance: 0 },
    midtones: { hue: 0, saturation: 0, luminance: 0 },
    highlights: { hue: 0, saturation: 0, luminance: 0 },
    global: { hue: 0, saturation: 0, luminance: 0 },
    blending: 50,
    balance: 0
  };

  test('Neutral grading produces symmetric baseline tone curve across R, G, B', () => {
    const tables = generateColorGradingTables(0, 0, 0, 0, neutralGrading);
    const rValues = tables.tableR.split(' ').map(Number);
    const gValues = tables.tableG.split(' ').map(Number);
    const bValues = tables.tableB.split(' ').map(Number);

    expect(rValues.length).toBe(33);
    expect(gValues.length).toBe(33);
    expect(bValues.length).toBe(33);

    // All channels must be identical when no color grading is applied
    for (let i = 0; i < 33; i++) {
      expect(rValues[i]).toBeCloseTo(gValues[i], 4);
      expect(rValues[i]).toBeCloseTo(bValues[i], 4);
    }
  });

  test('Shadows grading tints ONLY shadows and leaves highlights 100% untouched', () => {
    // Apply cold cyan tint to shadows (Hue = 180, Saturation = 80)
    const shadowBlueGrading: ColorGradingAdjustments = {
      ...neutralGrading,
      shadows: { hue: 180, saturation: 80, luminance: 0 }
    };

    const tables = generateColorGradingTables(0, 0, 0, 0, shadowBlueGrading);
    const rValues = tables.tableR.split(' ').map(Number);
    const gValues = tables.tableG.split(' ').map(Number);
    const bValues = tables.tableB.split(' ').map(Number);

    // 1. In shadows (e.g. index 3, ~10% luminance): cyan boosts G and B, attenuates R
    expect(bValues[3]).toBeGreaterThan(rValues[3]);
    expect(gValues[3]).toBeGreaterThan(rValues[3]);

    // 2. In highlights (e.g. index 28 to 32, >= 85% luminance): shadows grade MUST be zero!
    // R, G, B must be identical (no tint bleed into highlights or sky)
    for (let i = 28; i < 33; i++) {
      expect(rValues[i]).toBeCloseTo(gValues[i], 4);
      expect(rValues[i]).toBeCloseTo(bValues[i], 4);
    }
  });

  test('Highlights grading tints ONLY highlights and leaves shadows 100% untouched', () => {
    // Apply warm golden tint to highlights (Hue = 35, Saturation = 85)
    const highlightWarmGrading: ColorGradingAdjustments = {
      ...neutralGrading,
      highlights: { hue: 35, saturation: 85, luminance: 0 }
    };

    const tables = generateColorGradingTables(0, 0, 0, 0, highlightWarmGrading);
    const rValues = tables.tableR.split(' ').map(Number);
    const gValues = tables.tableG.split(' ').map(Number);
    const bValues = tables.tableB.split(' ').map(Number);

    // 1. In highlights (e.g. index 28, ~87% luminance): warm boosts R and G, decreases B
    expect(rValues[28]).toBeGreaterThan(bValues[28]);
    expect(gValues[28]).toBeGreaterThan(bValues[28]);

    // 2. In shadows (e.g. index 0 to 5, <= 15% luminance): highlights grade MUST be zero!
    // R, G, B must be identical (no warm cast in deep blacks or dark shadows)
    for (let i = 0; i <= 5; i++) {
      expect(rValues[i]).toBeCloseTo(gValues[i], 4);
      expect(rValues[i]).toBeCloseTo(bValues[i], 4);
    }
  });

  test('Midtones grading protects pure black (x=0) and pure white (x=1)', () => {
    // Apply green tint to midtones (Hue = 120, Saturation = 90)
    const midtoneGreenGrading: ColorGradingAdjustments = {
      ...neutralGrading,
      midtones: { hue: 120, saturation: 90, luminance: 0 }
    };

    const tables = generateColorGradingTables(0, 0, 0, 0, midtoneGreenGrading);
    const rValues = tables.tableR.split(' ').map(Number);
    const gValues = tables.tableG.split(' ').map(Number);
    const bValues = tables.tableB.split(' ').map(Number);

    // Midtone peak around center (index 16, ~50% luminance): Green channel is boosted
    expect(gValues[16]).toBeGreaterThan(rValues[16]);
    expect(gValues[16]).toBeGreaterThan(bValues[16]);

    // At pure black (index 0): midtone tint is 0, channels are equal
    expect(rValues[0]).toBeCloseTo(gValues[0], 4);
    expect(rValues[0]).toBeCloseTo(bValues[0], 4);

    // At pure white (index 32): midtone tint is 0, channels are equal
    expect(rValues[32]).toBeCloseTo(gValues[32], 4);
    expect(rValues[32]).toBeCloseTo(bValues[32], 4);
  });

  test('Global grading affects all tones consistently', () => {
    // Apply magenta tint globally (Hue = 300, Saturation = 60)
    const globalMagentaGrading: ColorGradingAdjustments = {
      ...neutralGrading,
      global: { hue: 300, saturation: 60, luminance: 0 }
    };

    const tables = generateColorGradingTables(0, 0, 0, 0, globalMagentaGrading);
    const rValues = tables.tableR.split(' ').map(Number);
    const gValues = tables.tableG.split(' ').map(Number);
    const bValues = tables.tableB.split(' ').map(Number);

    // In shadows (index 5) and in highlights (index 27): R and B exceed G
    expect(rValues[5]).toBeGreaterThan(gValues[5]);
    expect(bValues[5]).toBeGreaterThan(gValues[5]);
    expect(rValues[27]).toBeGreaterThan(gValues[27]);
    expect(bValues[27]).toBeGreaterThan(gValues[27]);
  });

  test('Hue adjustment with Saturation at 0 remains strictly neutral until user increases Saturation', () => {
    // User sets Hue to 240 (Blue) but leaves saturation at 0%
    const hueOnlyGrading: ColorGradingAdjustments = {
      ...neutralGrading,
      shadows: { hue: 240, saturation: 0, luminance: 0 }
    };

    const tables = generateColorGradingTables(0, 0, 0, 0, hueOnlyGrading);
    const rValues = tables.tableR.split(' ').map(Number);
    const bValues = tables.tableB.split(' ').map(Number);

    // With Saturation at 0%, channels must remain strictly equal
    expect(bValues[3]).toBeCloseTo(rValues[3], 4);
  });

  test('HSL Mixer generates identity matrix when channels are neutral', () => {
    const { generateHslMixerMatrix } = require('../../src/core/image-engine/ColorGradingEngine');
    const matrixStr = generateHslMixerMatrix();
    const values = matrixStr.split(' ').map(Number);
    expect(values.length).toBe(20);
    // Identity diagonal: r_r = 1, g_g = 1, b_b = 1, a_a = 1
    expect(values[0]).toBe(1);
    expect(values[6]).toBe(1);
    expect(values[12]).toBe(1);
    expect(values[18]).toBe(1);
  });

  test('HSL Mixer Green and Blue Hue shifts modify respective color matrices', () => {
    const { computeHslMixerCoefficients } = require('../../src/core/image-engine/ColorGradingEngine');
    const mixer = [
      { hue: 0, saturation: 0, luminance: 0 },
      { hue: 0, saturation: 0, luminance: 0 },
      { hue: 0, saturation: 0, luminance: 0 },
      { hue: 50, saturation: 0, luminance: 0 }, // Green Hue +50 (toward Aqua)
      { hue: 0, saturation: 0, luminance: 0 },
      { hue: -50, saturation: 0, luminance: 0 }, // Blue Hue -50 (toward Teal)
      { hue: 0, saturation: 0, luminance: 0 },
      { hue: 0, saturation: 0, luminance: 0 }
    ];

    const coeffs = computeHslMixerCoefficients(mixer);
    // Green hue positive shifts toward aqua by adding blue in green channel (b_g > 0)
    expect(coeffs.b_g).toBeGreaterThan(0);
    // Blue hue negative shifts toward teal/aqua by adding green in blue channel (g_b > 0)
    expect(coeffs.g_b).toBeGreaterThan(0);
  });
});
