import {
  cloneEditDocument,
  createNewEditDocument,
  deserializeEditDocument,
  serializeEditDocument,
  validateEditDocument
} from '../../src/features/editor/models/EditDocument';

describe('EditDocument Model Unit Tests', () => {
  test('creates a valid default edit document', () => {
    const doc = createNewEditDocument('asset_123', 'file://image.jpg');
    expect(doc.id).toBeDefined();
    expect(doc.assetId).toBe('asset_123');
    expect(doc.sourceUri).toBe('file://image.jpg');
    expect(doc.version).toBe(1);
    expect(validateEditDocument(doc)).toBe(true);
  });

  test('validates out-of-range exposure and contrast values', () => {
    const doc = createNewEditDocument('asset_123', 'file://image.jpg');
    doc.basic.exposure = 3.5; // Out of [-2.0, 2.0]
    expect(validateEditDocument(doc)).toBe(false);

    doc.basic.exposure = 1.0;
    doc.basic.contrast = 150; // Out of [-100, 100]
    expect(validateEditDocument(doc)).toBe(false);
  });

  test('validates crop bounds correctly', () => {
    const doc = createNewEditDocument('asset_123', 'file://image.jpg');
    doc.crop.width = 1.5; // Out of (0, 1]
    expect(validateEditDocument(doc)).toBe(false);

    doc.crop.width = 0.5;
    doc.crop.x = 0.8; // x + width = 1.3 > 1.0
    expect(validateEditDocument(doc)).toBe(false);
  });

  test('deep clones documents without mutating original', () => {
    const doc = createNewEditDocument('asset_123', 'file://image.jpg');
    const clone = cloneEditDocument(doc);

    clone.basic.exposure = 1.25;
    expect(doc.basic.exposure).toBe(0);
    expect(clone.basic.exposure).toBe(1.25);
  });

  test('serializes and deserializes cleanly', () => {
    const doc = createNewEditDocument('asset_123', 'file://image.jpg');
    doc.basic.temperature = 25;
    doc.basic.tint = -10;

    const json = serializeEditDocument(doc);
    const restored = deserializeEditDocument(json);

    expect(restored.basic.temperature).toBe(25);
    expect(restored.basic.tint).toBe(-10);
    expect(validateEditDocument(restored)).toBe(true);
  });
});
