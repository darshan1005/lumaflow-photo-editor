import {
  createDefaultToneCurves,
  createNewEditDocument,
  interpolateCurveLut
} from '../../src/features/editor/models/EditDocument';
import {
  computeHslMixerCoefficients,
  computeWheelChannelDeltas,
  generateColorGradingTables
} from '../../src/core/image-engine/ColorGradingEngine';
import { useEditorStore } from '../../src/features/editor/state/useEditorStore';

describe('Curves, Real-time Histogram & Hue Sliders', () => {
  test('interpolateCurveLut accurately maps control points into 256-entry monotonic table', () => {
    const defaultCurves = createDefaultToneCurves();
    const linearLut = interpolateCurveLut(defaultCurves.composite);

    expect(linearLut.length).toBe(256);
    expect(linearLut[0]).toBe(0);
    expect(linearLut[64]).toBe(64);
    expect(linearLut[128]).toBe(128);
    expect(linearLut[192]).toBe(192);
    expect(linearLut[255]).toBe(255);

    // Test S-Curve contrast boost (Darker shadows, brighter highlights)
    const sCurvePoints = [
      { x: 0, y: 0 },
      { x: 64, y: 40 },   // Crushed shadows
      { x: 128, y: 128 }, // Preserved midtones
      { x: 192, y: 215 }, // Boosted highlights
      { x: 255, y: 255 }  // Preserved whites
    ];
    const sCurveLut = interpolateCurveLut(sCurvePoints);

    expect(sCurveLut[64]).toBe(40);
    expect(sCurveLut[64]).toBeLessThan(64);
    expect(sCurveLut[128]).toBe(128);
    expect(sCurveLut[192]).toBe(215);
    expect(sCurveLut[192]).toBeGreaterThan(192);
  });

  test('generateColorGradingTables applies Tone Curves to transfer curves', () => {
    const defaultCurves = createDefaultToneCurves();
    // Apply contrast S-curve to red channel only
    const customCurves = {
      ...defaultCurves,
      red: [
        { x: 0, y: 0 },
        { x: 64, y: 40 },
        { x: 128, y: 128 },
        { x: 192, y: 220 },
        { x: 255, y: 255 }
      ]
    };

    const linearTables = generateColorGradingTables(0, 0, 0, 0, undefined, defaultCurves);
    const redCurveTables = generateColorGradingTables(0, 0, 0, 0, undefined, customCurves);

    // Red table must reflect the custom curve
    expect(redCurveTables.tableR).not.toEqual(linearTables.tableR);
    // Green and Blue tables remain identical
    expect(redCurveTables.tableG).toEqual(linearTables.tableG);
    expect(redCurveTables.tableB).toEqual(linearTables.tableB);
  });

  test('HSL Mixer Hue slider modifies chromatic displacement matrix', () => {
    const doc = createNewEditDocument('test', 'file://test.jpg');
    const neutralCoeffs = computeHslMixerCoefficients(doc.hslMixer);

    // Baseline red channel has no hue rotation
    expect(neutralCoeffs.g_r).toBe(0);
    expect(neutralCoeffs.b_r).toBe(0);

    // Shift Red channel Hue toward Orange/Yellow (+60)
    doc.hslMixer[0].hue = 60;
    const warmRedCoeffs = computeHslMixerCoefficients(doc.hslMixer);

    expect(warmRedCoeffs.g_r).toBeGreaterThan(0); // Adds green to red channel to create orange
    expect(warmRedCoeffs.r_r).toBeLessThan(1.0);   // Reduces red proportionately

    // Shift Red channel Hue toward Magenta (-60)
    doc.hslMixer[0].hue = -60;
    const coolRedCoeffs = computeHslMixerCoefficients(doc.hslMixer);

    expect(coolRedCoeffs.b_r).toBeGreaterThan(0); // Adds blue to red channel to create magenta
    expect(coolRedCoeffs.r_r).toBeLessThan(1.0);
  });

  test('Color Grading wheel channel deltas activate when saturation > 0', () => {
    // 0 Saturation -> No chromatic displacement
    const [dR0, dG0, dB0] = computeWheelChannelDeltas(180, 0, 0);
    expect(dR0).toBe(0);
    expect(dG0).toBe(0);
    expect(dB0).toBe(0);

    // Saturation dialed in -> Hue dictates color direction
    const [dR, dG, dB] = computeWheelChannelDeltas(0, 50, 0); // Pure Red hue
    expect(dR).toBeGreaterThan(0); // Red boosted
    expect(dG).toBeLessThan(0);    // Green suppressed
    expect(dB).toBeLessThan(0);    // Blue suppressed
  });

  test('Store updates Curves state and preserves undo/redo history', () => {
    const { updateCurvePoint, undo, redo } = useEditorStore.getState();

    // Modify shadows point on Red curve
    updateCurvePoint('red', 1, { x: 64, y: 35 });
    let doc = useEditorStore.getState().currentDocument;
    expect(doc.curves.red[1].y).toBe(35);

    // Test Undo
    undo();
    doc = useEditorStore.getState().currentDocument;
    expect(doc.curves.red[1].y).toBe(64);

    // Test Redo
    redo();
    doc = useEditorStore.getState().currentDocument;
    expect(doc.curves.red[1].y).toBe(35);
  });
});
