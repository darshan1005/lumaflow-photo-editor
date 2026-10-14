import { EngineBenchmark } from '../../src/core/image-engine/benchmarks/EngineBenchmark';
import { PreviewCache } from '../../src/core/image-engine/cache/PreviewCache';
import { RenderQueue } from '../../src/core/image-engine/render-queue/RenderQueue';
import { createNewEditDocument } from '../../src/features/editor/models/EditDocument';

describe('Modular Image Engine: Benchmark & Performance Suite', () => {
  jest.setTimeout(25000);

  test('Benchmark 1: Comprehensive benchmark measures latency, memory, and export throughput', async () => {
    // Run benchmark with 5 iterations on a 320x180 preview frame for deterministic unit benchmarking
    const report = await EngineBenchmark.runComprehensiveBenchmark(5, 320, 180);

    expect(report).toBeDefined();
    expect(report.engineName).toContain('Lumaflow Modular Engine');
    expect(report.testIterations).toBe(5);

    // Frame latency should be bounded
    expect(report.averageLatencyMs).toBeGreaterThan(0);
    expect(report.minLatencyMs).toBeLessThanOrEqual(report.averageLatencyMs);
    expect(report.p95LatencyMs).toBeGreaterThanOrEqual(report.averageLatencyMs);

    // Memory peak should be bounded
    expect(report.memoryPeakMb).toBeGreaterThan(0);
    expect(report.memoryPeakMb).toBeLessThan(128); // Stays well below 128MB heap threshold

    // Cancellation efficiency under rapid slider scrubbing must be high (> 50%)
    expect(report.cancellationEfficiencyPercent).toBeGreaterThanOrEqual(50);

    // Export throughput must be positive
    expect(report.exportDurationMs).toBeGreaterThan(0);
    expect(report.exportThroughputMpxPerSec).toBeGreaterThan(0);
  });

  test('Benchmark 2: RenderQueue drops obsolete frames under rapid 120Hz slider scrubbing', async () => {
    let executedCount = 0;
    let cancelledCount = 0;

    const queue = new RenderQueue(async (doc, token) => {
      // Simulate GPU shader execution delay
      await new Promise(r => setTimeout(r, 10));
      if (token.isCancelled) {
        cancelledCount++;
        return {
          frameId: 0,
          renderTimeMs: 1,
          gpuTimeMs: 1,
          memoryUsageMb: 2,
          wasCancelled: true,
          timestamp: Date.now()
        };
      }
      executedCount++;
      return {
        frameId: 1,
        renderTimeMs: 10,
        gpuTimeMs: 10,
        memoryUsageMb: 4,
        wasCancelled: false,
        timestamp: Date.now()
      };
    });

    const doc = createNewEditDocument('scrub_test', 'file://scrub.jpg');

    // Simulate 25 rapid slider movements (scrubbing from -2.0 EV to +2.0 EV)
    const promises: Promise<any>[] = [];
    for (let i = 0; i < 25; i++) {
      doc.basic.exposure = -2.0 + (i * 0.16);
      promises.push(queue.enqueue(doc));
    }

    await Promise.all(promises);

    const efficiency = queue.getEfficiency();
    expect(efficiency.total).toBe(25);
    // Cancellation should drop obsolete intermediate renders
    expect(efficiency.dropped).toBeGreaterThanOrEqual(15);
    expect(efficiency.efficiencyPercent).toBeGreaterThan(60);
  });

  test('Benchmark 3: PreviewCache bounds memory usage and evicts LRU textures', () => {
    // 16 MB max cache budget
    const cache = new PreviewCache(16 * 1024 * 1024);

    // Insert 5 preview items of 4MB each (total 20MB > 16MB budget)
    for (let i = 0; i < 5; i++) {
      cache.set(`cache://texture_${i}`, { buffer: `simulated_texture_data_${i}` }, 4 * 1024 * 1024);
    }

    // Cache size must remain bounded within 16MB budget
    expect(cache.getMemoryUsageMb()).toBeLessThanOrEqual(16);
    // Oldest items must have been evicted, leaving at most 4 items
    expect(cache.getItemCount()).toBeLessThanOrEqual(4);
    expect(cache.has('cache://texture_0')).toBe(false); // Evicted first
    expect(cache.has('cache://texture_4')).toBe(true);  // Preserved latest
  });

  test('Benchmark 4: Non-destructive original preservation guarantees unchanged source', () => {
    const originalUri = 'file:///storage/DCIM/original_raw_shot.dng';
    const doc = createNewEditDocument('orig_test', originalUri);

    // Apply intense destructive-style edits
    doc.basic.exposure = 2.0;
    doc.basic.contrast = 80;
    doc.basic.saturation = -100; // Monochrome
    doc.crop.rotation = 90;

    // Verify source URI and original assetId are immutable and unchanged
    expect(doc.sourceUri).toBe(originalUri);
    expect(doc.assetId).toBe('orig_test');
    expect(doc.version).toBe(1);
  });
});
