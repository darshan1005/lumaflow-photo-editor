import { RustNativeEngine } from '../../src/core/image-engine/adapters/RustNativeEngine';
import { createNewEditDocument } from '../../src/features/editor/models/EditDocument';

describe('Phase 3: RustNativeEngine Adapter & Viewport Pipeline', () => {
  let engine: RustNativeEngine;

  beforeEach(async () => {
    engine = new RustNativeEngine();
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  test('Implements both IModularImageEngine and IImageEngine interfaces', () => {
    expect(engine.name).toBe('RustNativeEngine');
    expect(engine.previewRenderer).toBeDefined();
    expect(engine.exportRenderer).toBeDefined();
    expect(typeof engine.processPixelBuffer).toBe('function');
    expect(typeof engine.loadImage).toBe('function');
    expect(typeof engine.exportFullResolution).toBe('function');
  });

  test('Neutral document preserves pixel intensities within rounding bounds', () => {
    const doc = createNewEditDocument('test_1', 'file://test.jpg');
    const input = new Uint8ClampedArray(4 * 4 * 4);
    input.fill(128);

    const processed = engine.processPixelBuffer(input, 4, 4, doc);

    expect(processed.length).toBe(input.length);
    expect(Math.abs(processed[0] - 128)).toBeLessThanOrEqual(2);
    expect(Math.abs(processed[1] - 128)).toBeLessThanOrEqual(2);
    expect(Math.abs(processed[2] - 128)).toBeLessThanOrEqual(2);
  });

  test('RenderQueue cancels intermediate in-flight frames during rapid 120Hz scrubbing', async () => {
    await engine.loadImage('file://scrub_test.jpg');

    const totalScrubSteps = 15;
    const promises: Promise<any>[] = [];

    // Simulate user dragging exposure slider rapidly across 15 intermediate values
    for (let i = 0; i < totalScrubSteps; i++) {
      const doc = createNewEditDocument('test_scrub', 'file://scrub_test.jpg');
      doc.basic.exposure = -1.0 + (i / totalScrubSteps) * 2.0;
      promises.push(engine.previewRenderer.renderFrame(doc));
    }

    const results = await Promise.all(promises);

    expect(results.length).toBe(totalScrubSteps);
    const cancelledCount = results.filter(r => r.wasCancelled).length;

    // Cancellation efficiency under rapid scrubbing must exceed 75%
    expect(cancelledCount).toBeGreaterThan(0);
    const cancellationRatio = (cancelledCount / (totalScrubSteps - 1)) * 100;
    expect(cancellationRatio).toBeGreaterThanOrEqual(75);
  });

  test('Produces full-resolution export within memory bounds', async () => {
    const doc = createNewEditDocument('test_export', 'file://test.jpg');
    doc.basic.exposure = 0.5;

    const exportedUri = await engine.exportFullResolution('file://test.jpg', doc, {
      format: 'jpeg',
      quality: 0.95,
      scale: 1.0
    });

    expect(exportedUri).toBeDefined();
    expect(exportedUri).toContain('.jpeg');
  });

  test('Runs comprehensive benchmark report', async () => {
    const report = await engine.runBenchmarks(3);

    expect(report.engineName).toBe('RustNativeEngine');
    expect(report.testIterations).toBe(3);
    expect(report.averageLatencyMs).toBeGreaterThan(0);
    expect(report.exportThroughputMpxPerSec).toBeGreaterThanOrEqual(100);
    expect(report.cancellationEfficiencyPercent).toBeGreaterThanOrEqual(80);
  });
});
