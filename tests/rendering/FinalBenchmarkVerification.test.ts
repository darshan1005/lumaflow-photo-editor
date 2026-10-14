import { CpuImageEngine } from '../../src/core/image-engine/adapters/CpuEngine';
import { RustNativeEngine } from '../../src/core/image-engine/adapters/RustNativeEngine';
import { calculateTilesNative } from '../../src/core/image-engine/native/LumaflowNativeBridge';
import { createNewEditDocument } from '../../src/features/editor/models/EditDocument';

describe('Phase 6: Final Benchmark Verification & Performance Evaluation', () => {
  let rustEngine: RustNativeEngine;
  let cpuEngine: CpuImageEngine;

  beforeEach(async () => {
    rustEngine = new RustNativeEngine();
    cpuEngine = new CpuImageEngine();
    await rustEngine.initialize();
  });

  afterEach(() => {
    rustEngine.dispose();
  });

  test('Benchmark 1: 1080p Interactive Preview Latency & Frame Rate Targets', async () => {
    await rustEngine.loadImage('file://bench_1080p.jpg', 1920);
    const doc = createNewEditDocument('test_1080p', 'file://bench_1080p.jpg');
    doc.basic.exposure = 0.75;
    doc.basic.temperature = 25;
    doc.basic.contrast = 20;

    const metrics = await rustEngine.previewRenderer.renderFrame(doc);

    expect(metrics).toBeDefined();
    expect(metrics.wasCancelled).toBe(false);
    expect(metrics.renderTimeMs).toBeGreaterThan(0);
    // Frame metrics verify responsiveness
    expect(metrics.memoryUsageMb).toBeLessThanOrEqual(32.0);
  });

  test('Benchmark 2: RenderQueue Cancellation Efficiency Under 120Hz Scrubbing', async () => {
    await rustEngine.loadImage('file://scrub_120hz.jpg');
    const totalFrames = 25;
    const promises: Promise<any>[] = [];

    // Simulate aggressive 120Hz scrubbing across 25 intermediate slider values
    for (let i = 0; i < totalFrames; i++) {
      const doc = createNewEditDocument('scrub', 'file://scrub_120hz.jpg');
      doc.basic.exposure = -2.0 + (i / totalFrames) * 4.0;
      promises.push(rustEngine.previewRenderer.renderFrame(doc));
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(totalFrames);

    const cancelledCount = results.filter(r => r.wasCancelled).length;
    const cancellationEfficiency = (cancelledCount / (totalFrames - 1)) * 100;

    // Cancellation efficiency must comfortably exceed the 75% target threshold
    expect(cancellationEfficiency).toBeGreaterThanOrEqual(75.0);
  });

  test('Benchmark 3: 48MP Memory-Bounded Tiled Export (<45MB RAM Bound)', async () => {
    const doc = createNewEditDocument('export_48mp', 'file://48mp_sample.jpg');
    doc.basic.exposure = 0.5;
    doc.basic.vibrance = 20;

    // Simulate 48MP export (Scale 1.0 = 8000x6000)
    const exportResult = await rustEngine.exportRenderer.exportImage('file://48mp_sample.jpg', doc, {
      format: 'jpeg',
      quality: 0.95,
      scale: 1.0
    });

    expect(exportResult.outputUri).toContain('.jpeg');
    // 48MP (8000x6000) with 2048x2048 tile size must produce 12 tiles
    expect(exportResult.tilesProcessed).toBe(12);

    // CRITICAL: Peak memory per tile must strictly satisfy <45MB to prevent Android LMK crashes
    expect(exportResult.peakTileMemoryMb).toBeLessThan(45.0);
    expect(exportResult.peakTileMemoryMb).toBeCloseTo(16.0, 0); // 2048*2048*4 / 1024^2 = 16.0 MB

    // Preserved EXIF photographic tags
    expect(exportResult.preservedExif).toBeDefined();
    expect(exportResult.preservedExif.software).toContain('Rust Core Engine');
  });

  test('Benchmark 4: Final Comprehensive Benchmark Report Generation', async () => {
    const report = await rustEngine.runBenchmarks(3);

    expect(report.engineName).toBe('RustNativeEngine');
    expect(report.testIterations).toBe(3);
    expect(report.fps).toBeGreaterThanOrEqual(30);
    expect(report.exportThroughputMpxPerSec).toBeGreaterThanOrEqual(100.0);
    expect(report.cancellationEfficiencyPercent).toBeGreaterThanOrEqual(80.0);
    expect(report.memoryPeakMb).toBeLessThanOrEqual(64.0);
  });
});
