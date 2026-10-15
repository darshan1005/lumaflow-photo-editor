import { CpuImageEngine } from '../../src/core/image-engine/adapters/CpuEngine';
import { renderDocument } from '../../src/core/image-engine/renderDocument';
import { createNewEditDocument } from '../../src/features/editor/models/EditDocument';

type Rgb = [number, number, number];

const SOURCE_COLORS: Rgb[] = [
  [204, 51, 51],   // red, HSL saturation 0.60
  [204, 128, 51],  // orange, HSL saturation about 0.60
  [51, 204, 51],   // green, HSL saturation 0.60
  [51, 51, 204],   // blue, HSL saturation 0.60
  [128, 128, 128]  // neutral gray
];

function rgba(colors: Rgb[]): Uint8ClampedArray {
  return new Uint8ClampedArray(colors.flatMap(([r, g, b]) => [r, g, b, 255]));
}

function rgbToHsl([rByte, gByte, bByte]: Rgb): [number, number, number] {
  const r = rByte / 255;
  const g = gByte / 255;
  const b = bByte / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta <= 1e-5) return [0, 0, lightness];

  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);
  let hue = 0;
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [hue / 6, saturation, lightness];
}

function outputRgb(data: Uint8ClampedArray, index: number): Rgb {
  const offset = index * 4;
  return [data[offset], data[offset + 1], data[offset + 2]];
}

function colorDifference(a: Rgb, b: Rgb): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
}

function mixerDocument(channel: number, key: 'hue' | 'saturation' | 'luminance', value: number) {
  const document = createNewEditDocument(`mixer-${channel}-${key}-${value}`, 'memory://mixer');
  document.hslMixer[channel][key] = value;
  return document;
}

describe('CPU HSL mixer processing', () => {
  const engine = new CpuImageEngine();
  const source = rgba(SOURCE_COLORS);
  const neutral = engine.processPixelBuffer(source, SOURCE_COLORS.length, 1, createNewEditDocument('neutral', 'memory://mixer'));

  test.each([
    ['red', 0, 0],
    ['orange', 1, 1],
    ['green', 3, 2],
    ['blue', 5, 3]
  ] as const)('saturation +/- affects the selected %s pixel in HSL space', (name, channel, pixelIndex) => {
    const baseHsl = rgbToHsl(SOURCE_COLORS[pixelIndex]);
    const increased = engine.processPixelBuffer(
      source,
      SOURCE_COLORS.length,
      1,
      mixerDocument(channel, 'saturation', 100)
    );
    const decreased = engine.processPixelBuffer(
      source,
      SOURCE_COLORS.length,
      1,
      mixerDocument(channel, 'saturation', -100)
    );

    const increasedHsl = rgbToHsl(outputRgb(increased, pixelIndex));
    const decreasedHsl = rgbToHsl(outputRgb(decreased, pixelIndex));
    expect(increasedHsl[1]).toBeGreaterThan(baseHsl[1] + 0.25);
    expect(decreasedHsl[1]).toBeLessThan(baseHsl[1] - 0.25);

    // A channel edit must not become a whole-image color matrix. Gray and
    // hues outside the selected band's feather remain at their neutral output.
    for (const unrelatedIndex of [0, 1, 2, 3, 4]) {
      if (unrelatedIndex === pixelIndex) continue;
      expect(colorDifference(outputRgb(increased, unrelatedIndex), outputRgb(neutral, unrelatedIndex))).toBeLessThanOrEqual(2);
      expect(colorDifference(outputRgb(decreased, unrelatedIndex), outputRgb(neutral, unrelatedIndex))).toBeLessThanOrEqual(2);
    }
  });

  test.each([
    ['red', 0, 0],
    ['orange', 1, 1],
    ['green', 3, 2],
    ['blue', 5, 3]
  ] as const)('luminance +/- changes HSL lightness only in the selected %s pixel', (name, channel, pixelIndex) => {
    const baseHsl = rgbToHsl(SOURCE_COLORS[pixelIndex]);
    const increased = engine.processPixelBuffer(
      source,
      SOURCE_COLORS.length,
      1,
      mixerDocument(channel, 'luminance', 100)
    );
    const decreased = engine.processPixelBuffer(
      source,
      SOURCE_COLORS.length,
      1,
      mixerDocument(channel, 'luminance', -100)
    );

    const increasedHsl = rgbToHsl(outputRgb(increased, pixelIndex));
    const decreasedHsl = rgbToHsl(outputRgb(decreased, pixelIndex));
    expect(increasedHsl[2]).toBeGreaterThan(baseHsl[2] + 0.15);
    expect(decreasedHsl[2]).toBeLessThan(baseHsl[2] - 0.15);

    for (const unrelatedIndex of [0, 1, 2, 3, 4]) {
      if (unrelatedIndex === pixelIndex) continue;
      expect(colorDifference(outputRgb(increased, unrelatedIndex), outputRgb(neutral, unrelatedIndex))).toBeLessThanOrEqual(2);
      expect(colorDifference(outputRgb(decreased, unrelatedIndex), outputRgb(neutral, unrelatedIndex))).toBeLessThanOrEqual(2);
    }
  });

  test('HSL channel weighting feathers nearby hues without affecting distant colors', () => {
    const featheredSource = rgba([
      SOURCE_COLORS[0],
      [204, 102, 51], // 20° orange-red: inside red's feather
      SOURCE_COLORS[2]
    ]);
    const baseline = engine.processPixelBuffer(
      featheredSource,
      3,
      1,
      createNewEditDocument('feather-neutral', 'memory://mixer')
    );
    const processed = engine.processPixelBuffer(
      featheredSource,
      3,
      1,
      mixerDocument(0, 'saturation', 100)
    );

    const selectedDifference = colorDifference(outputRgb(processed, 0), outputRgb(baseline, 0));
    const nearbyDifference = colorDifference(outputRgb(processed, 1), outputRgb(baseline, 1));
    const distantDifference = colorDifference(outputRgb(processed, 2), outputRgb(baseline, 2));
    expect(nearbyDifference).toBeGreaterThan(2);
    expect(nearbyDifference).toBeLessThan(selectedDifference);
    expect(distantDifference).toBeLessThanOrEqual(2);
  });

  test('hue shift +/- rotates hue in the selected channel', () => {
    // Green channel (channel 3, pixelIndex 2)
    const baseGreenHsl = rgbToHsl(SOURCE_COLORS[2]);
    const greenShiftPlus = engine.processPixelBuffer(
      source,
      SOURCE_COLORS.length,
      1,
      mixerDocument(3, 'hue', 100)
    );
    const greenShiftMinus = engine.processPixelBuffer(
      source,
      SOURCE_COLORS.length,
      1,
      mixerDocument(3, 'hue', -100)
    );
    const plusHsl = rgbToHsl(outputRgb(greenShiftPlus, 2));
    const minusHsl = rgbToHsl(outputRgb(greenShiftMinus, 2));

    expect(plusHsl[0]).toBeGreaterThan(baseGreenHsl[0] + 0.08); // rotated toward aqua
    expect(minusHsl[0]).toBeLessThan(baseGreenHsl[0] - 0.08);    // rotated toward yellow

    // Other channels (e.g. blue at index 3, gray at index 4) should remain untouched
    expect(colorDifference(outputRgb(greenShiftPlus, 3), outputRgb(neutral, 3))).toBeLessThanOrEqual(2);
    expect(colorDifference(outputRgb(greenShiftPlus, 4), outputRgb(neutral, 4))).toBeLessThanOrEqual(2);
  });

  test('the preview render path applies mixer saturation, luminance and hue adjustments', () => {
    const saturationPreview = renderDocument(
      source,
      SOURCE_COLORS.length,
      1,
      mixerDocument(0, 'saturation', 100)
    ).pixels;
    const luminancePreview = renderDocument(
      source,
      SOURCE_COLORS.length,
      1,
      mixerDocument(0, 'luminance', 100)
    ).pixels;
    const huePreview = renderDocument(
      source,
      SOURCE_COLORS.length,
      1,
      mixerDocument(3, 'hue', 100)
    ).pixels;

    expect(colorDifference(outputRgb(saturationPreview, 0), outputRgb(neutral, 0))).toBeGreaterThan(30);
    expect(colorDifference(outputRgb(luminancePreview, 0), outputRgb(neutral, 0))).toBeGreaterThan(30);
    expect(colorDifference(outputRgb(huePreview, 2), outputRgb(neutral, 2))).toBeGreaterThan(30);
  });
});
