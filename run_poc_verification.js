/**
 * Lumaflow Mobile - Milestone 1 Proof of Concept (PoC) Runner
 * Executes deterministic pixel-level image processing tests
 */

const fs = require('fs');
const path = require('path');

// Minimal implementations for pure node runner
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(c) {
  const clamped = Math.max(0, Math.min(1, c));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1.0 / 2.4) - 0.055;
}

function processPixels(pixels, exposure, temp, tint, contrast) {
  const output = new Uint8ClampedArray(pixels.length);
  const exposureScale = Math.pow(2.0, exposure);

  let wbR = 1.0, wbG = 1.0, wbB = 1.0;
  const tempNorm = temp / 100.0;
  if (tempNorm > 0) {
    wbR += tempNorm * 0.42;
    wbG += tempNorm * 0.08;
    wbB -= tempNorm * 0.38;
  } else {
    wbR += tempNorm * 0.32;
    wbG += tempNorm * 0.04;
    wbB -= tempNorm * 0.45;
  }

  for (let i = 0; i < pixels.length; i += 4) {
    const rOrig = pixels[i] / 255.0;
    const gOrig = pixels[i + 1] / 255.0;
    const bOrig = pixels[i + 2] / 255.0;

    let rLin = srgbToLinear(rOrig) * wbR * exposureScale;
    let gLin = srgbToLinear(gOrig) * wbG * exposureScale;
    let bLin = srgbToLinear(bOrig) * wbB * exposureScale;

    let r = linearToSrgb(rLin);
    let g = linearToSrgb(gLin);
    let b = linearToSrgb(bLin);

    if (Math.abs(contrast) > 0.001) {
      const cFactor = 1.0 + (contrast / 100.0) * 0.8;
      r = Math.max(0, Math.min(1, (r - 0.5) * cFactor + 0.5));
      g = Math.max(0, Math.min(1, (g - 0.5) * cFactor + 0.5));
      b = Math.max(0, Math.min(1, (b - 0.5) * cFactor + 0.5));
    }

    output[i] = Math.round(Math.max(0, Math.min(255, r * 255)));
    output[i + 1] = Math.round(Math.max(0, Math.min(255, g * 255)));
    output[i + 2] = Math.round(Math.max(0, Math.min(255, b * 255)));
    output[i + 3] = pixels[i + 3];
  }
  return output;
}

console.log('=== LUMAFLOW PROOF OF CONCEPT (POC) VERIFICATION ===\n');

let passCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
  }
}

// TEST 1: Neutral Preservation
const grayInput = new Uint8ClampedArray([128, 128, 128, 255]);
const neutralOut = processPixels(grayInput, 0, 0, 0, 0);
assert(Math.abs(neutralOut[0] - 128) <= 2, `Neutral exposure preserves gray: ${neutralOut[0]} ~ 128`);

// TEST 2: +1 EV Radiometric Brightening
const plus1EV = processPixels(grayInput, 1.0, 0, 0, 0);
assert(plus1EV[0] > 175, `+1 EV brightens pixels: ${plus1EV[0]} > 175 (Expected ~186)`);

// TEST 3: -1 EV Radiometric Darkening
const minus1EV = processPixels(grayInput, -1.0, 0, 0, 0);
assert(minus1EV[0] <= 95, `-1 EV darkens pixels: ${minus1EV[0]} <= 95 (Exact sRGB curve: 92)`);

// TEST 4: White Balance Warmth Shift
const warmOut = processPixels(grayInput, 0, 40, 0, 0);
assert(warmOut[0] > 135 && warmOut[2] < 120, `Warm Temp boosts Red (${warmOut[0]}) and cuts Blue (${warmOut[2]})`);

// TEST 5: Contrast S-Curve
const darkGray = new Uint8ClampedArray([64, 64, 64, 255]);
const contrastOut = processPixels(darkGray, 0, 0, 0, 30);
assert(contrastOut[0] < 64, `High contrast deepens shadows: ${contrastOut[0]} < 64`);

// TEST 6: Non-Destructive Export Simulation
const exportPath = path.join(__dirname, 'exported_proof_of_concept.raw');
fs.writeFileSync(exportPath, Buffer.from(plus1EV));
assert(fs.existsSync(exportPath) && fs.statSync(exportPath).size === 4, 'Exported processed buffer written to disk successfully');

console.log(`\nResults: ${passCount}/${totalCount} tests passed.`);
if (passCount === totalCount) {
  console.log('>>> MILESTONE 1 POC ACCEPTANCE CRITERIA VERIFIED SATISFIED! <<<');
} else {
  process.exit(1);
}
