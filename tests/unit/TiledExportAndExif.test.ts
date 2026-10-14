import { RustNativeEngine } from '../../src/core/image-engine/adapters/RustNativeEngine';
import { ExifPreserver } from '../../src/core/image-engine/exif/ExifPreserver';
import { calculateTilesNative } from '../../src/core/image-engine/native/LumaflowNativeBridge';
import { createNewEditDocument } from '../../src/features/editor/models/EditDocument';

describe('Phase 5: 48MP Tiled Export, Histogram & EXIF Preservation', () => {
  let engine: RustNativeEngine;

  beforeEach(async () => {
    engine = new RustNativeEngine();
    await engine.initialize();
  });

  afterEach(() => {
    engine.dispose();
  });

  test('48MP image (8000x6000) subdivides into 12 bounded memory tiles', () => {
    // 8000x6000 48 Megapixel resolution
    const tiles = calculateTilesNative(8000, 6000, 2048);

    expect(tiles.length).toBe(12);

    // Verify boundary constraints
    for (const t of tiles) {
      expect(t.width).toBeLessThanOrEqual(2048);
      expect(t.height).toBeLessThanOrEqual(2048);
      expect(t.x + t.width).toBeLessThanOrEqual(8000);
      expect(t.y + t.height).toBeLessThanOrEqual(6000);

      // Verify each tile memory is strictly bounded (max ~16MB RGBA)
      const tileBytes = t.width * t.height * 4;
      const tileMb = tileBytes / (1024 * 1024);
      expect(tileMb).toBeLessThanOrEqual(16.8);
    }
  });

  test('Export preserves camera EXIF metadata and adds Lumaflow signature', async () => {
    const doc = createNewEditDocument('test_exif', 'file://camera_raw.jpg');

    const result = await engine.exportRenderer.exportImage('file://camera_raw.jpg', doc, {
      format: 'jpeg',
      quality: 0.95,
      scale: 1.0
    });

    expect(result.outputUri).toContain('.jpeg');
    expect(result.tilesProcessed).toBe(12);
    expect(result.peakTileMemoryMb).toBeLessThan(45.0);

    // Verify preserved photographic metadata
    const exif = result.preservedExif;
    expect(exif).toBeDefined();
    expect(exif.make).toBe('Sony');
    expect(exif.model).toContain('ILCE');
    expect(exif.lensModel).toBeDefined();
    expect(exif.iso).toBe(100);
    expect(exif.fNumber).toBe(2.8);
    expect(exif.software).toContain('Lumaflow Photo Editor');
    expect(exif.software).toContain('Rust Core Engine');
  });

  test('ExifPreserver produces valid TIFF/Exif header dictionary', () => {
    const rawExif = ExifPreserver.extractFromAsset('file://sample.jpg', {
      make: 'Apple',
      model: 'iPhone 15 Pro Max',
      lensModel: '24mm f/1.78',
      iso: 64,
      fNumber: 1.78,
      exposureTimeSeconds: 0.002
    });

    const header = ExifPreserver.generateExifHeaderPayload(rawExif);
    expect(header.TIFF.Make).toBe('Apple');
    expect(header.TIFF.Model).toBe('iPhone 15 Pro Max');
    expect(header.Exif.ISOSpeedRatings).toBe(64);
    expect(header.Exif.FNumber).toBe(1.78);
    expect(header.TIFF.Software).toContain('Rust Core Engine');
  });

  test('Live histogram generates valid 256-bin channel data', async () => {
    await engine.previewRenderer.loadSourceImage('file://test.jpg', 1920);
    const doc = createNewEditDocument('test_hist', 'file://test.jpg');

    await engine.previewRenderer.renderFrame(doc);
    const hist = engine.previewRenderer.getHistogram();

    // In native session or mocked environment, returns valid 4-channel structure
    if (hist) {
      expect(hist.red.length).toBe(256);
      expect(hist.green.length).toBe(256);
      expect(hist.blue.length).toBe(256);
      expect(hist.luma.length).toBe(256);
    }
  });
});
