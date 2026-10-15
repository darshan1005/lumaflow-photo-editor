import { CpuImageEngine, maskWeight } from '../../src/core/image-engine/adapters/CpuEngine';
import { renderDocument } from '../../src/core/image-engine/renderDocument';
import { createNewEditDocument } from '../../src/features/editor/models/EditDocument';
import { EditDocument, MaskAdjustment } from '../../src/types';

function pixel(values: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(values.flatMap(value => [value, value, value, 255]));
}

function rgba(values: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(values.flatMap(value => [value, 0, 0, 255]));
}

function mask(overrides: Partial<MaskAdjustment> = {}): MaskAdjustment {
  return {
    id: 'mask',
    name: 'test mask',
    type: 'linear',
    inverted: false,
    opacity: 100,
    exposure: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    highlights: 0,
    shadows: 0,
    start: { x: 0.25, y: 0.5 },
    end: { x: 0.75, y: 0.5 },
    ...overrides
  };
}

function channelAt(data: Uint8ClampedArray, index: number, channel = 0): number {
  return data[index * 4 + channel];
}

describe('CPU tool processing and document rendering', () => {
  let engine: CpuImageEngine;

  beforeEach(() => {
    engine = new CpuImageEngine();
  });

  test('neutral processing preserves pixels and processPixelBuffer dimensions', () => {
    const doc = createNewEditDocument('neutral', 'memory://neutral');
    const source = new Uint8ClampedArray([12, 34, 56, 255, 128, 129, 130, 200]);
    const rendered = engine.processPixelBuffer(source, 2, 1, doc);

    expect(rendered.length).toBe(source.length);
    expect(Array.from(rendered)).toEqual(Array.from(source));
  });

  test('curves isolate a channel and HSL hue changes leave gray neutral', () => {
    const curveDoc = createNewEditDocument('curves', 'memory://curves');
    curveDoc.curves.red = [{ x: 0, y: 0 }, { x: 128, y: 255 }, { x: 255, y: 255 }];
    const curved = engine.processPixelBuffer(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1, curveDoc);
    expect(curved[0]).toBeGreaterThan(240);
    expect(curved[1]).toBe(128);
    expect(curved[2]).toBe(128);

    const hslDoc = createNewEditDocument('hsl', 'memory://hsl');
    hslDoc.hslMixer[0].hue = 60;
    hslDoc.hslMixer[0].saturation = 100;
    const hsl = engine.processPixelBuffer(
      new Uint8ClampedArray([128, 128, 128, 255, 255, 0, 0, 255, 0, 0, 255, 255]),
      3,
      1,
      hslDoc
    );
    expect(Array.from(hsl.slice(0, 3))).toEqual([128, 128, 128]);
    expect(hsl[4 + 1]).toBeGreaterThan(0); // red moved toward orange
    expect(Array.from(hsl.slice(8, 11))).toEqual([0, 0, 255]); // blue is isolated
  });

  test('clone and heal spots use source coordinates with feathered boundaries', () => {
    const source = new Uint8ClampedArray([
      20, 20, 220, 255, 20, 20, 220, 255, 20, 20, 220, 255,
      220, 20, 20, 255, 220, 20, 20, 255, 220, 20, 20, 255,
      220, 20, 20, 255, 220, 20, 20, 255, 220, 20, 20, 255
    ]);
    const cloneDoc = createNewEditDocument('clone', 'memory://clone');
    cloneDoc.healingSpots = [{
      id: 'clone', x: 0.5, y: 0.5, radius: 0.3, sourceX: 1 / 18, sourceY: 0.5,
      mode: 'clone', opacity: 100, feather: 50
    } as EditDocument['healingSpots'][number]];
    const cloned = engine.processPixelBuffer(source, 9, 1, cloneDoc);
    expect(Array.from(cloned.slice(4 * 4, 4 * 4 + 3))).toEqual([20, 20, 220]);
    expect(channelAt(cloned, 6)).toBeGreaterThan(20);
    expect(channelAt(cloned, 6)).toBeLessThan(220);

    const healDoc = createNewEditDocument('heal', 'memory://heal');
    healDoc.healingSpots = [{
      id: 'heal', x: 0.5, y: 0.5, radius: 0.22, sourceX: 1 / 18, sourceY: 0.5,
      mode: 'heal', opacity: 100
    } as EditDocument['healingSpots'][number]];
    const healed = engine.processPixelBuffer(source, 9, 1, healDoc);
    // Boundary matching turns the solid blue donor into the surrounding red,
    // rather than copying a conspicuous blue patch into the red destination.
    expect(channelAt(healed, 4)).toBeGreaterThan(150);
    expect(healed[4 * 4 + 2]).toBeLessThan(80);
  });

  test('linear masks isolate local exposure, inversion swaps it, and opacity blends it', () => {
    const source = pixel([128, 128, 128, 128]);
    const doc = createNewEditDocument('mask', 'memory://mask');
    doc.masks = [mask({ exposure: 1 })];
    const selected = engine.processPixelBuffer(source, 4, 1, doc);
    expect(channelAt(selected, 0)).toBeGreaterThan(channelAt(selected, 3));
    expect(channelAt(selected, 3)).toBe(128);
    expect(maskWeight(doc.masks[0], 0.1, 0.5)).toBe(1);
    expect(maskWeight(doc.masks[0], 0.9, 0.5)).toBe(0);

    const invertedDoc = createNewEditDocument('mask-invert', 'memory://mask-invert');
    invertedDoc.masks = [mask({ exposure: 1, inverted: true })];
    const inverted = engine.processPixelBuffer(source, 4, 1, invertedDoc);
    expect(channelAt(inverted, 0)).toBe(128);
    expect(channelAt(inverted, 3)).toBeGreaterThan(128);

    const opacityDoc = createNewEditDocument('mask-opacity', 'memory://mask-opacity');
    opacityDoc.masks = [mask({ exposure: 1, opacity: 50 })];
    const half = engine.processPixelBuffer(source, 4, 1, opacityDoc);
    expect(channelAt(half, 0)).toBeGreaterThan(128);
    expect(channelAt(half, 0)).toBeLessThan(channelAt(selected, 0));
  });

  test('renderDocument returns cropped oriented dimensions and clockwise quarter-turn pixels', () => {
    const doc = createNewEditDocument('geometry', 'memory://geometry');
    doc.crop.rotation = 90;
    doc.crop.x = 0;
    doc.crop.y = 0;
    doc.crop.width = 1;
    doc.crop.height = 0.5;
    const source = rgba([1, 2, 3, 4, 5, 6, 7, 8]); // 4x2, rows [1..4] and [5..8]
    const rendered = renderDocument(source, 4, 2, doc);

    expect(rendered.width).toBe(2);
    expect(rendered.height).toBe(2);
    expect(Array.from(rendered.pixels.filter((_, index) => index % 4 === 0))).toEqual([5, 1, 6, 2]);
  });
});
