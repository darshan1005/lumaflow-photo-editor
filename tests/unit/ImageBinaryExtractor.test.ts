import { ImageBinaryExtractor } from '../../src/core/image-engine/ImageBinaryExtractor';

describe('ImageBinaryExtractor Engine', () => {
  test('correctly inspects binary JPEG header', () => {
    // Construct valid JPEG SOF0 header
    const jpegBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
      0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x04, 0x38, 0x07, 0x80, 0x03, 0x01, 0x11
    ]);

    const header = ImageBinaryExtractor.inspectBinaryHeader(jpegBytes);
    expect(header.format).toBe('jpeg');
    expect(header.mimeType).toBe('image/jpeg');
    expect(header.width).toBe(1920); // 0x0780 = 1920
    expect(header.height).toBe(1080); // 0x0438 = 1080
    expect(header.aspectRatio).toBeCloseTo(1.7778, 3);
    expect(header.hasAlphaChannel).toBe(false);
  });

  test('correctly inspects binary PNG header', () => {
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR Chunk
      0x00, 0x00, 0x05, 0x00, // Width 1280
      0x00, 0x00, 0x02, 0xd0, // Height 720
      0x08, 0x06, 0x00, 0x00, 0x00 // 8 bit, RGBA (type 6)
    ]);

    const header = ImageBinaryExtractor.inspectBinaryHeader(pngBytes);
    expect(header.format).toBe('png');
    expect(header.mimeType).toBe('image/png');
    expect(header.width).toBe(1280);
    expect(header.height).toBe(720);
    expect(header.hasAlphaChannel).toBe(true);
  });

  test('extracts 256-bin histograms and tonal metrics from pixel buffer', () => {
    const buffer = ImageBinaryExtractor.createSyntheticTestBuffer(100, 100);
    const analysis = ImageBinaryExtractor.extractFromPixelBuffer(buffer, 100, 100);

    expect(analysis.histograms.luminance.length).toBe(256);
    expect(analysis.histograms.red.length).toBe(256);
    expect(analysis.histograms.green.length).toBe(256);
    expect(analysis.histograms.blue.length).toBe(256);

    expect(analysis.tonalMetrics.meanLuminance).toBeGreaterThan(0);
    expect(analysis.tonalMetrics.meanLuminance).toBeLessThan(1);
    expect(analysis.tonalMetrics.whitePoint).toBeGreaterThanOrEqual(analysis.tonalMetrics.blackPoint);
    expect(analysis.tonalMetrics.dynamicRangeEV).toBeGreaterThan(0);

    // Algorithmic recommendations
    expect(analysis.recommendedLightAdjustments).toBeDefined();
    expect(typeof analysis.recommendedLightAdjustments.exposure).toBe('number');
    expect(typeof analysis.recommendedLightAdjustments.whites).toBe('number');
    expect(typeof analysis.recommendedLightAdjustments.blacks).toBe('number');
    expect(typeof analysis.recommendedLightAdjustments.clarity).toBe('number');
    expect(typeof analysis.recommendedLightAdjustments.sharpening).toBe('number');
    expect(analysis.recommendedLightAdjustments.analysisSummary.length).toBeGreaterThan(5);
  });

  test('computes intelligent algorithmic adjustments for dark underexposed image', () => {
    // Generate dark underexposed buffer
    const darkBuffer = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < darkBuffer.length; i += 4) {
      darkBuffer[i] = 20;     // R
      darkBuffer[i + 1] = 20; // G
      darkBuffer[i + 2] = 20; // B
      darkBuffer[i + 3] = 255;
    }

    const analysis = ImageBinaryExtractor.extractFromPixelBuffer(darkBuffer, 100, 100);
    // Underexposed image should trigger positive exposure and shadow lift
    expect(analysis.recommendedLightAdjustments.exposure).toBeGreaterThan(0.5);
    expect(analysis.recommendedLightAdjustments.shadows).toBeGreaterThan(0);
  });
});
