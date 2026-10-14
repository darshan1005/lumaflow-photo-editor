import { EditDocument, ExportOptions } from '../../../types';
import { IImageEngine } from '../interfaces/ImageEngine';

export class CpuImageEngine implements IImageEngine {
  async initialize(): Promise<void> {
    // No-op for CPU engine
  }

  async loadImage(uri: string): Promise<{ width: number; height: number }> {
    return { width: 1920, height: 1080 };
  }

  // Linearize sRGB to radiometric space
  private srgbToLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  // De-linearize back to perceptual sRGB
  private linearToSrgb(c: number): number {
    const clamped = Math.max(0, Math.min(1, c));
    return clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * Math.pow(clamped, 1.0 / 2.4) - 0.055;
  }

  // RGB [0..1] to HSL [0..1]
  private rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const l = (max + min) * 0.5;
    let s = 0;
    let h = 0;

    if (delta > 1e-5) {
      s = l > 0.5 ? delta / (2.0 - max - min) : delta / (max + min);
      if (max === r) {
        h = (g - b) / delta + (g < b ? 6.0 : 0.0);
      } else if (max === g) {
        h = (b - r) / delta + 2.0;
      } else {
        h = (r - g) / delta + 4.0;
      }
      h /= 6.0;
    }
    return [h, s, l];
  }

  private hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1.0;
    if (t > 1) t -= 1.0;
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0 / 2.0) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    if (s < 1e-5) return [l, l, l];
    const q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    const p = 2.0 * l - q;
    return [
      this.hue2rgb(p, q, h + 1.0 / 3.0),
      this.hue2rgb(p, q, h),
      this.hue2rgb(p, q, h - 1.0 / 3.0)
    ];
  }

  private hueDistance(h1: number, h2: number): number {
    const d = Math.abs(h1 - h2);
    return d > 0.5 ? 1.0 - d : d;
  }

  private smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3.0 - 2.0 * t);
  }

  processPixelBuffer(
    pixels: Uint8ClampedArray,
    width: number,
    height: number,
    doc: EditDocument
  ): Uint8ClampedArray {
    const output = new Uint8ClampedArray(pixels.length);
    const b = doc.basic;
    const g = doc.colorGrading;
    const m = doc.hslMixer;

    // Precalculate Exposure scale in radiometric linear space
    const exposureScale = Math.pow(2.0, b.exposure);

    // Precalculate White Balance Multipliers
    const tempNorm = b.temperature / 100.0;
    const tintNorm = b.tint / 100.0;

    let wbR = 1.0, wbG = 1.0, wbB = 1.0;
    if (tempNorm > 0) {
      wbR += tempNorm * 0.42;
      wbG += tempNorm * 0.08;
      wbB -= tempNorm * 0.38;
    } else {
      wbR += tempNorm * 0.32;
      wbG += tempNorm * 0.04;
      wbB -= tempNorm * 0.45;
    }

    if (tintNorm > 0) {
      wbR += tintNorm * 0.16;
      wbG -= tintNorm * 0.32;
      wbB += tintNorm * 0.16;
    } else {
      wbR += tintNorm * 0.14;
      wbG -= tintNorm * 0.30;
      wbB += tintNorm * 0.08;
    }

    // Color grading tint offsets
    const sHsl = this.hslToRgb(g.shadows.hue / 360, 1.0, 0.5);
    const mHsl = this.hslToRgb(g.midtones.hue / 360, 1.0, 0.5);
    const hHsl = this.hslToRgb(g.highlights.hue / 360, 1.0, 0.5);
    const globHsl = this.hslToRgb(g.global.hue / 360, 1.0, 0.5);

    const sTint = sHsl.map(v => (v - 0.5) * (g.shadows.saturation / 100.0) * 0.6);
    const mTint = mHsl.map(v => (v - 0.5) * (g.midtones.saturation / 100.0) * 0.6);
    const hTint = hHsl.map(v => (v - 0.5) * (g.highlights.saturation / 100.0) * 0.6);
    const gTint = globHsl.map(v => (v - 0.5) * (g.global.saturation / 100.0) * 0.6);

    const sLuma = (g.shadows.luminance / 100.0) * 0.3;
    const mLuma = (g.midtones.luminance / 100.0) * 0.3;
    const hLuma = (g.highlights.luminance / 100.0) * 0.3;
    const gLuma = (g.global.luminance / 100.0) * 0.3;

    const midThreshold = Math.max(0.1, Math.min(0.9, 0.5 + (g.balance / 100.0) * 0.25));
    const blendWidth = 0.2 + (g.blending / 100.0) * 0.5;

    // HSL Mixer Hue centers
    const HUE_CENTERS = [0.0, 0.0833, 0.1667, 0.3333, 0.5, 0.6667, 0.7778, 0.8889];
    const HUE_WIDTHS = [0.09, 0.07, 0.08, 0.12, 0.09, 0.11, 0.08, 0.09];

    for (let i = 0; i < pixels.length; i += 4) {
      // Step 1: Normalize input [0..1]
      const rOrig = pixels[i] / 255.0;
      const gOrig = pixels[i + 1] / 255.0;
      const bOrig = pixels[i + 2] / 255.0;
      const aOrig = pixels[i + 3];

      // Step 2: Linearize to radiometric space
      let rLin = this.srgbToLinear(rOrig) * wbR * exposureScale;
      let gLin = this.srgbToLinear(gOrig) * wbG * exposureScale;
      let bLin = this.srgbToLinear(bOrig) * wbB * exposureScale;

      // Step 3: De-linearize to working perceptual space
      let r = this.linearToSrgb(rLin);
      let gVal = this.linearToSrgb(gLin);
      let bVal = this.linearToSrgb(bLin);

      let luma = 0.2126 * r + 0.7152 * gVal + 0.0722 * bVal;

      // Contrast S-curve
      if (Math.abs(b.contrast) > 0.001) {
        const cFactor = 1.0 + (b.contrast / 100.0) * 0.8;
        r = Math.max(0, Math.min(1, (r - 0.5) * cFactor + 0.5));
        gVal = Math.max(0, Math.min(1, (gVal - 0.5) * cFactor + 0.5));
        bVal = Math.max(0, Math.min(1, (bVal - 0.5) * cFactor + 0.5));
        luma = 0.2126 * r + 0.7152 * gVal + 0.0722 * bVal;
      }

      // Highlights & Shadows
      if (Math.abs(b.highlights) > 0.001) {
        const hw = this.smoothstep(0.4, 1.0, luma);
        const adj = (b.highlights / 100.0) * 0.35 * hw;
        r += r * adj;
        gVal += gVal * adj;
        bVal += bVal * adj;
      }
      if (Math.abs(b.shadows) > 0.001) {
        const sw = 1.0 - this.smoothstep(0.0, 0.6, luma);
        const adj = (b.shadows / 100.0) * 0.35 * sw;
        r += (1.0 - r) * adj;
        gVal += (1.0 - gVal) * adj;
        bVal += (1.0 - bVal) * adj;
      }

      // Step 4: 3-Way Color Grading
      luma = 0.2126 * r + 0.7152 * gVal + 0.0722 * bVal;
      const shadowWeight = 1.0 - this.smoothstep(0.0, midThreshold + blendWidth * 0.5, luma);
      const highlightWeight = this.smoothstep(midThreshold - blendWidth * 0.5, 1.0, luma);
      const midtoneWeight = Math.max(0, Math.min(1, 1.0 - shadowWeight - highlightWeight));

      r += (sTint[0] + sLuma) * shadowWeight + (mTint[0] + mLuma) * midtoneWeight + (hTint[0] + hLuma) * highlightWeight + (gTint[0] + gLuma);
      gVal += (sTint[1] + sLuma) * shadowWeight + (mTint[1] + mLuma) * midtoneWeight + (hTint[1] + hLuma) * highlightWeight + (gTint[1] + gLuma);
      bVal += (sTint[2] + sLuma) * shadowWeight + (mTint[2] + mLuma) * midtoneWeight + (hTint[2] + hLuma) * highlightWeight + (gTint[2] + gLuma);

      r = Math.max(0, Math.min(1, r));
      gVal = Math.max(0, Math.min(1, gVal));
      bVal = Math.max(0, Math.min(1, bVal));

      // Step 5: 8-Channel HSL Mixer
      const [h, s, l] = this.rgbToHsl(r, gVal, bVal);
      let hueShift = 0;
      let satScale = 0;
      let lumaShift = 0;

      for (let ch = 0; ch < 8; ch++) {
        const d = this.hueDistance(h, HUE_CENTERS[ch]);
        const w = Math.pow(Math.max(0, 1.0 - d / HUE_WIDTHS[ch]), 2);
        if (w > 0) {
          hueShift += w * (m[ch].hue / 100.0) * 0.12;
          satScale += w * (m[ch].saturation / 100.0);
          lumaShift += w * (m[ch].luminance / 100.0) * 0.3;
        }
      }

      let newH = (h + hueShift + 1.0) % 1.0;
      let newS = Math.max(0, Math.min(1, s * (1.0 + satScale)));
      let newL = Math.max(0, Math.min(1, l + lumaShift));

      // Step 6: Vibrance & Saturation
      if (Math.abs(b.vibrance) > 0.001) {
        const skinDist = this.hueDistance(newH, 0.08);
        const skinProtect = this.smoothstep(0.0, 0.12, skinDist);
        const vibFactor = (1.0 - newS) * (b.vibrance / 100.0) * (0.4 + 0.6 * skinProtect);
        newS = Math.max(0, Math.min(1, newS * (1.0 + vibFactor)));
      }

      const [finalR, finalG, finalB] = this.hslToRgb(newH, newS, newL);
      let outR = finalR;
      let outG = finalG;
      let outB = finalB;

      if (Math.abs(b.saturation) > 0.001) {
        const finalLuma = 0.2126 * outR + 0.7152 * outG + 0.0722 * outB;
        const satMult = 1.0 + b.saturation / 100.0;
        outR = finalLuma + (outR - finalLuma) * satMult;
        outG = finalLuma + (outG - finalLuma) * satMult;
        outB = finalLuma + (outB - finalLuma) * satMult;
      }

      output[i] = Math.round(Math.max(0, Math.min(255, outR * 255)));
      output[i + 1] = Math.round(Math.max(0, Math.min(255, outG * 255)));
      output[i + 2] = Math.round(Math.max(0, Math.min(255, outB * 255)));
      output[i + 3] = aOrig;
    }

    return output;
  }

  async exportFullResolution(
    sourceUri: string,
    document: EditDocument,
    options: ExportOptions
  ): Promise<string> {
    return `file://exported_${Date.now()}.${options.format}`;
  }

  dispose(): void {
    // cleanup
  }
}
