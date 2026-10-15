import { CpuImageEngine } from '../../src/core/image-engine/adapters/CpuEngine';
import { renderDocument } from '../../src/core/image-engine/renderDocument';
import { createNewEditDocument } from '../../src/features/editor/models/EditDocument';
import { EditDocument } from '../../src/types';

function grayscale(values: number[]): Uint8ClampedArray {
  return new Uint8ClampedArray(values.flatMap(value => [value, value, value, 255]));
}

function channelAt(data: Uint8ClampedArray, index: number): number {
  return data[index * 4];
}

function totalDifference(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let difference = 0;
  for (let index = 0; index < a.length; index += 4) {
    difference += Math.abs(a[index] - b[index]);
    difference += Math.abs(a[index + 1] - b[index + 1]);
    difference += Math.abs(a[index + 2] - b[index + 2]);
  }
  return difference;
}

function documentWith(
  key: keyof EditDocument['basic'],
  value: number
): EditDocument {
  const document = createNewEditDocument(`light-${String(key)}-${value}`, 'memory://light');
  document.basic[key] = value as never;
  return document;
}

describe('Light adjustment pixel processing', () => {
  const engine = new CpuImageEngine();
  const tonalSource = grayscale([24, 80, 160, 232]);

  test.each([
    ['shadows', 0, 100, 0],
    ['shadows', 0, -100, 0],
    ['whites', 3, 100, 3],
    ['whites', 3, -100, 3],
    ['blacks', 0, 100, 0],
    ['blacks', 0, -100, 0]
  ] as const)('%s %s changes the targeted tonal pixels', (key, sample, value, expectedSample) => {
    const neutral = engine.processPixelBuffer(tonalSource, 4, 1, createNewEditDocument('neutral-light', 'memory://light'));
    const processed = engine.processPixelBuffer(tonalSource, 4, 1, documentWith(key, value));

    expect(totalDifference(processed, neutral)).toBeGreaterThan(8);
    if (value > 0) {
      expect(channelAt(processed, expectedSample)).toBeGreaterThan(channelAt(neutral, expectedSample));
    } else {
      expect(channelAt(processed, expectedSample)).toBeLessThan(channelAt(neutral, expectedSample));
    }
  });

  test('clarity and sharpening alter local edges in both supported directions', () => {
    const source = grayscale([32, 32, 32, 224, 224]);
    const neutral = engine.processPixelBuffer(source, 5, 1, createNewEditDocument('neutral-detail', 'memory://light'));
    const positiveClarity = engine.processPixelBuffer(source, 5, 1, documentWith('clarity', 100));
    const negativeClarity = engine.processPixelBuffer(source, 5, 1, documentWith('clarity', -100));
    const positiveSharpening = engine.processPixelBuffer(source, 5, 1, documentWith('sharpening', 100));
    const negativeSharpening = engine.processPixelBuffer(source, 5, 1, documentWith('sharpening', -100));

    expect(totalDifference(positiveClarity, neutral)).toBeGreaterThan(8);
    expect(totalDifference(negativeClarity, neutral)).toBeGreaterThan(8);
    expect(totalDifference(positiveSharpening, neutral)).toBeGreaterThan(8);
    expect(totalDifference(negativeSharpening, neutral)).toBeGreaterThan(8);
    expect(channelAt(positiveClarity, 2)).toBeLessThan(channelAt(neutral, 2));
    expect(channelAt(negativeClarity, 2)).toBeGreaterThan(channelAt(neutral, 2));
    expect(channelAt(positiveSharpening, 2)).toBeLessThan(channelAt(neutral, 2));
    expect(channelAt(negativeSharpening, 2)).toBeGreaterThan(channelAt(neutral, 2));
  });

  test('the preview renderer applies Light adjustments instead of returning the source bitmap', () => {
    const source = grayscale([24, 32, 32, 224, 232]);
    const neutral = renderDocument(
      source,
      5,
      1,
      createNewEditDocument('preview-neutral', 'memory://light')
    ).pixels;

    for (const [key, value] of [
      ['shadows', 100],
      ['shadows', -100],
      ['whites', 100],
      ['whites', -100],
      ['blacks', 100],
      ['blacks', -100],
      ['clarity', 100],
      ['clarity', -100],
      ['sharpening', 100],
      ['sharpening', -100]
    ] as const) {
      const rendered = renderDocument(source, 5, 1, documentWith(key, value)).pixels;
      expect(totalDifference(rendered, neutral)).toBeGreaterThan(8);
    }
  });
});
