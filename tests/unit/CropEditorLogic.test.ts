jest.mock('react-native', () => ({
  ScrollView: 'ScrollView',
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View'
}));

import {
  clampCropBounds,
  getCropInteractionHandle,
  getCenteredCropForAspectRatio,
  getCropAspectRatio,
  getLockedCropAspectRatio,
  getNormalizedCropAspectRatio,
  getOrientedSourceDimensions,
  moveCropBounds,
  resizeCropBounds
} from '../../src/features/editor/components/CropEditor';

describe('CropEditor crop geometry', () => {
  test('uses the active rotation orientation when calculating a source ratio', () => {
    expect(getOrientedSourceDimensions(2400, 1600, 0)).toEqual({ width: 2400, height: 1600 });
    expect(getOrientedSourceDimensions(2400, 1600, 90)).toEqual({ width: 1600, height: 2400 });

    expect(getCropAspectRatio({ x: 0, y: 0, width: 1, height: 1 }, 2400, 1600, 0)).toBeCloseTo(1.5);
    expect(getCropAspectRatio({ x: 0, y: 0, width: 1, height: 1 }, 2400, 1600, 90)).toBeCloseTo(2 / 3);
  });

  test('fits a preset inside the current bounds and preserves its center', () => {
    const current = { x: 0.1, y: 0.2, width: 0.4, height: 0.5 };
    const next = getCenteredCropForAspectRatio(current, 16 / 9, 2400, 1600, 0);

    expect(next.x + next.width / 2).toBeCloseTo(current.x + current.width / 2);
    expect(next.y + next.height / 2).toBeCloseTo(current.y + current.height / 2);
    expect(next.x).toBeGreaterThanOrEqual(current.x);
    expect(next.y).toBeGreaterThanOrEqual(current.y);
    expect(next.x + next.width).toBeLessThanOrEqual(current.x + current.width);
    expect(next.y + next.height).toBeLessThanOrEqual(current.y + current.height);
    expect(getCropAspectRatio(next, 2400, 1600, 0)).toBeCloseTo(16 / 9);
  });

  test('calculates a portrait preset against a rotated source', () => {
    const next = getCenteredCropForAspectRatio(
      { x: 0, y: 0, width: 1, height: 1 },
      4 / 5,
      2400,
      1600,
      90
    );

    expect(next.x).toBeCloseTo(0);
    expect(next.y).toBeCloseTo(1 / 12);
    expect(next.width).toBeCloseTo(1);
    expect(next.height).toBeCloseTo(5 / 6);
    expect(getCropAspectRatio(next, 2400, 1600, 90)).toBeCloseTo(4 / 5);
  });

  test('clamps crop controls to a usable normalized rectangle', () => {
    expect(clampCropBounds({ x: 0.9, y: -1, width: 2, height: 0 })).toEqual({
      x: 0,
      y: 0,
      width: 1,
      height: 0.001
    });
  });

  test('moves the frame while keeping it inside the source bounds', () => {
    expect(moveCropBounds({ x: 0.2, y: 0.25, width: 0.4, height: 0.5 }, 0.7, -0.5)).toEqual({
      x: 0.6,
      y: 0,
      width: 0.4,
      height: 0.5
    });
  });

  test('resizes free edges and corners independently', () => {
    expect(resizeCropBounds({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 }, 'left', -0.1, 0)).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.6,
      height: 0.5
    });
    expect(resizeCropBounds({ x: 0.2, y: 0.2, width: 0.5, height: 0.5 }, 'bottom-right', 0.2, -0.1)).toEqual({
      x: 0.2,
      y: 0.2,
      width: 0.7,
      height: 0.4
    });
  });

  test('locks edge and corner resizing to the displayed source ratio', () => {
    const original = { x: 0.1, y: 0.1, width: 0.4, height: 0.4 };
    const normalizedSquareRatio = getNormalizedCropAspectRatio('free', 4000, 3000, 0);
    const lockedCorner = resizeCropBounds(original, 'bottom-right', 0.2, 0.1, 0.75);
    expect(getCropAspectRatio(lockedCorner, 4000, 3000, 0)).toBeCloseTo(1);

    const rotatedOriginalRatio = getLockedCropAspectRatio('original', 4000, 3000, 90);
    expect(rotatedOriginalRatio).toBeCloseTo(0.75);
    expect(normalizedSquareRatio).toBeNull();
    const normalizedRotatedOriginalRatio = getNormalizedCropAspectRatio('original', 4000, 3000, 90);
    expect(getCropAspectRatio(
      resizeCropBounds(original, 'right', 0.2, 0, normalizedRotatedOriginalRatio as number),
      4000,
      3000,
      90
    )).toBeCloseTo(rotatedOriginalRatio as number);
  });

  test('identifies move, edge, and corner hit targets', () => {
    const bounds = { x: 0.2, y: 0.2, width: 0.5, height: 0.5 };
    expect(getCropInteractionHandle(450, 450, 1000, 1000, bounds)).toBe('move');
    expect(getCropInteractionHandle(200, 500, 1000, 1000, bounds)).toBe('left');
    expect(getCropInteractionHandle(700, 700, 1000, 1000, bounds)).toBe('bottom-right');
  });
});
