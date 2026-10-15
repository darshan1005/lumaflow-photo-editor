import { EditDocument } from '../../types';
import { CpuImageEngine, maskWeight } from './adapters/CpuEngine';

export { maskWeight } from './adapters/CpuEngine';

interface RgbaSample {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function quarterTurn(value: number): number {
  const normalized = ((Math.round(value / 90) * 90) % 360 + 360) % 360;
  return normalized;
}

function bilinearSample(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  normalizedX: number,
  normalizedY: number
): RgbaSample {
  // Normalized coordinates refer to pixel centers. Subtracting 0.5 makes a
  // full-size, identity crop sample the original pixels without a half-pixel
  // shift, while the clamps provide sensible edge behavior.
  const fx = clamp(normalizedX) * width - 0.5;
  const fy = clamp(normalizedY) * height - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const read = (x: number, y: number): [number, number, number, number] => {
    const px = Math.max(0, Math.min(width - 1, x));
    const py = Math.max(0, Math.min(height - 1, y));
    const offset = (py * width + px) * 4;
    return [pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]];
  };
  const p00 = read(x0, y0);
  const p10 = read(x0 + 1, y0);
  const p01 = read(x0, y0 + 1);
  const p11 = read(x0 + 1, y0 + 1);
  const interpolate = (channel: number): number =>
    p00[channel] * (1 - tx) * (1 - ty) +
    p10[channel] * tx * (1 - ty) +
    p01[channel] * (1 - tx) * ty +
    p11[channel] * tx * ty;
  return { r: interpolate(0), g: interpolate(1), b: interpolate(2), a: interpolate(3) };
}

/**
 * Render an EditDocument against an RGBA source buffer.
 *
 * CPU editing remains source-sized through processPixelBuffer. Geometry is
 * deliberately performed here afterward so callers that use the engine for a
 * preview can keep the long-standing same-dimensions process contract.
 */
export function renderDocument(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  doc: EditDocument
): { pixels: Uint8ClampedArray; width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { pixels: new Uint8ClampedArray(), width: 0, height: 0 };
  }

  const processed = new CpuImageEngine().processPixelBuffer(pixels, width, height, doc);
  const crop = doc.crop;
  const rotation = quarterTurn(crop.rotation);
  const orientedWidth = rotation === 90 || rotation === 270 ? height : width;
  const orientedHeight = rotation === 90 || rotation === 270 ? width : height;
  const cropX = clamp(crop.x);
  const cropY = clamp(crop.y);
  const cropWidth = clamp(crop.width);
  const cropHeight = clamp(crop.height);
  const outputWidth = Math.max(1, Math.round(orientedWidth * cropWidth));
  const outputHeight = Math.max(1, Math.round(orientedHeight * cropHeight));
  const output = new Uint8ClampedArray(outputWidth * outputHeight * 4);
  const angle = (crop.straightenAngle * Math.PI) / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const coverZoom = Math.max(
    Math.abs(cosine) + (orientedHeight / orientedWidth) * Math.abs(sine),
    Math.abs(cosine) + (orientedWidth / orientedHeight) * Math.abs(sine)
  );

  for (let y = 0; y < outputHeight; y++) {
    for (let x = 0; x < outputWidth; x++) {
      // Crop coordinates are in the oriented frame and use output pixel
      // centers, as specified by the document geometry contract.
      let orientedX = cropX + (x + 0.5) / outputWidth * cropWidth;
      let orientedY = cropY + (y + 0.5) / outputHeight * cropHeight;

      if (crop.flipHorizontal) orientedX = 1 - orientedX;
      if (crop.flipVertical) orientedY = 1 - orientedY;

      // Undo the display's cover-scaled straighten rotation around the
      // oriented image center.
      const orientedPixelX = orientedX * orientedWidth;
      const orientedPixelY = orientedY * orientedHeight;
      const centeredX = orientedPixelX - orientedWidth / 2;
      const centeredY = orientedPixelY - orientedHeight / 2;
      const inverseRotatedX = (centeredX * cosine + centeredY * sine) / coverZoom;
      const inverseRotatedY = (-centeredX * sine + centeredY * cosine) / coverZoom;
      const straightenedX = (orientedWidth / 2 + inverseRotatedX) / orientedWidth;
      const straightenedY = (orientedHeight / 2 + inverseRotatedY) / orientedHeight;

      // Undo the clockwise quarter turn. These mappings use normalized
      // coordinates, so they remain correct when W and H are different.
      let sourceX: number;
      let sourceY: number;
      if (rotation === 90) {
        sourceX = straightenedY;
        sourceY = 1 - straightenedX;
      } else if (rotation === 180) {
        sourceX = 1 - straightenedX;
        sourceY = 1 - straightenedY;
      } else if (rotation === 270) {
        sourceX = 1 - straightenedY;
        sourceY = straightenedX;
      } else {
        sourceX = straightenedX;
        sourceY = straightenedY;
      }

      const sample = bilinearSample(processed, width, height, sourceX, sourceY);
      const offset = (y * outputWidth + x) * 4;
      output[offset] = Math.round(sample.r);
      output[offset + 1] = Math.round(sample.g);
      output[offset + 2] = Math.round(sample.b);
      output[offset + 3] = Math.round(sample.a);
    }
  }

  return { pixels: output, width: outputWidth, height: outputHeight };
}
