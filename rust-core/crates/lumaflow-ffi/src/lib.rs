use std::os::raw::c_char;
use std::slice;
use lumaflow_core::{
    BasicAdjustments, ColorGradingAdjustments, ColorWheelTone, EditDocument, HslChannel,
    HslMixerAdjustments, ImageProcessor,
};

#[repr(C)]
pub struct CBasicAdjustments {
    pub exposure: f32,
    pub contrast: f32,
    pub highlights: f32,
    pub shadows: f32,
    pub whites: f32,
    pub blacks: f32,
    pub temperature: f32,
    pub tint: f32,
    pub vibrance: f32,
    pub saturation: f32,
    pub clarity: f32,
    pub vignette: f32,
    pub grain: f32,
    pub sharpening: f32,
}

#[repr(C)]
pub struct CColorWheelTone {
    pub hue: f32,
    pub saturation: f32,
    pub luminance: f32,
}

#[repr(C)]
pub struct CColorGradingAdjustments {
    pub shadows: CColorWheelTone,
    pub midtones: CColorWheelTone,
    pub highlights: CColorWheelTone,
    pub global: CColorWheelTone,
    pub blending: f32,
    pub balance: f32,
}

#[repr(C)]
pub struct CHslChannel {
    pub hue: f32,
    pub saturation: f32,
    pub luminance: f32,
}

#[repr(C)]
pub struct CNativeEditDocument {
    pub basic: CBasicAdjustments,
    pub color_grading: CColorGradingAdjustments,
    pub hsl_mixer: [CHslChannel; 8],
}

impl From<&CNativeEditDocument> for EditDocument {
    fn from(c: &CNativeEditDocument) -> Self {
        let mut doc = EditDocument::default();
        doc.basic = BasicAdjustments {
            exposure: c.basic.exposure,
            contrast: c.basic.contrast,
            highlights: c.basic.highlights,
            shadows: c.basic.shadows,
            whites: c.basic.whites,
            blacks: c.basic.blacks,
            temperature: c.basic.temperature,
            tint: c.basic.tint,
            vibrance: c.basic.vibrance,
            saturation: c.basic.saturation,
            clarity: c.basic.clarity,
            vignette: c.basic.vignette,
            grain: c.basic.grain,
            sharpening: c.basic.sharpening,
        };
        doc.color_grading = ColorGradingAdjustments {
            shadows: ColorWheelTone {
                hue: c.color_grading.shadows.hue,
                saturation: c.color_grading.shadows.saturation,
                luminance: c.color_grading.shadows.luminance,
            },
            midtones: ColorWheelTone {
                hue: c.color_grading.midtones.hue,
                saturation: c.color_grading.midtones.saturation,
                luminance: c.color_grading.midtones.luminance,
            },
            highlights: ColorWheelTone {
                hue: c.color_grading.highlights.hue,
                saturation: c.color_grading.highlights.saturation,
                luminance: c.color_grading.highlights.luminance,
            },
            global: ColorWheelTone {
                hue: c.color_grading.global.hue,
                saturation: c.color_grading.global.saturation,
                luminance: c.color_grading.global.luminance,
            },
            blending: c.color_grading.blending,
            balance: c.color_grading.balance,
        };
        let mut mixer: HslMixerAdjustments = [HslChannel::default(); 8];
        for i in 0..8 {
            mixer[i] = HslChannel {
                hue: c.hsl_mixer[i].hue,
                saturation: c.hsl_mixer[i].saturation,
                luminance: c.hsl_mixer[i].luminance,
            };
        }
        doc.hsl_mixer = mixer;
        doc
    }
}

/// Process an RGBA pixel buffer directly via pointers (Zero-Copy)
#[no_mangle]
pub unsafe extern "C" fn lumaflow_process_rgba(
    input_ptr: *const u8,
    output_ptr: *mut u8,
    width: u32,
    height: u32,
    doc_ptr: *const CNativeEditDocument,
) -> i32 {
    if input_ptr.is_null() || output_ptr.is_null() || doc_ptr.is_null() {
        return -1;
    }

    let byte_count = (width * height * 4) as usize;
    let input = slice::from_raw_parts(input_ptr, byte_count);
    let output = slice::from_raw_parts_mut(output_ptr, byte_count);
    let c_doc = &*doc_ptr;
    let doc = EditDocument::from(c_doc);

    ImageProcessor::process_rgba_buffer(input, output, width, height, &doc);
    0
}

/// Fast parallel histogram calculation across RGBA buffer
/// out_hist_ptr must point to an allocated array of 4 * 256 uint32_t (1024 uint32 entries)
/// Layout: [Red x 256, Green x 256, Blue x 256, Luma x 256]
#[no_mangle]
pub unsafe extern "C" fn lumaflow_compute_histogram(
    rgba_ptr: *const u8,
    length: usize,
    out_hist_ptr: *mut u32,
) -> i32 {
    if rgba_ptr.is_null() || out_hist_ptr.is_null() || length % 4 != 0 {
        return -1;
    }

    let pixels = slice::from_raw_parts(rgba_ptr, length);
    let hist = ImageProcessor::compute_histogram(pixels);
    let out = slice::from_raw_parts_mut(out_hist_ptr, 1024);

    out[0..256].copy_from_slice(&hist.red);
    out[256..512].copy_from_slice(&hist.green);
    out[512..768].copy_from_slice(&hist.blue);
    out[768..1024].copy_from_slice(&hist.luma);

    0
}

/// Returns null-terminated engine version string
#[no_mangle]
pub extern "C" fn lumaflow_version() -> *const c_char {
    static VERSION: &[u8] = b"1.0.0-rust-native\0";
    VERSION.as_ptr() as *const c_char
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct CTileBounds {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Calculate tiles for full-res image subdivision
/// Writes up to max_tiles into out_tiles_ptr, returns total tile count (or negative error)
#[no_mangle]
pub unsafe extern "C" fn lumaflow_calculate_tiles(
    full_width: u32,
    full_height: u32,
    tile_size: u32,
    out_tiles_ptr: *mut CTileBounds,
    max_tiles: u32,
) -> i32 {
    let processor = lumaflow_core::TiledProcessor::new(if tile_size == 0 { 2048 } else { tile_size });
    let tiles = processor.calculate_tiles(full_width, full_height);
    let count = tiles.len();

    if !out_tiles_ptr.is_null() && max_tiles > 0 {
        let to_copy = count.min(max_tiles as usize);
        let out_slice = slice::from_raw_parts_mut(out_tiles_ptr, to_copy);
        for i in 0..to_copy {
            out_slice[i] = CTileBounds {
                x: tiles[i].x,
                y: tiles[i].y,
                width: tiles[i].width,
                height: tiles[i].height,
            };
        }
    }

    count as i32
}

/// Process a single tile buffer in-place
#[no_mangle]
pub unsafe extern "C" fn lumaflow_process_tile(
    tile_ptr: *mut u8,
    tile_width: u32,
    tile_height: u32,
    doc_ptr: *const CNativeEditDocument,
) -> i32 {
    if tile_ptr.is_null() || doc_ptr.is_null() {
        return -1;
    }

    let byte_count = (tile_width * tile_height * 4) as usize;
    let tile_slice = slice::from_raw_parts_mut(tile_ptr, byte_count);
    let c_doc = &*doc_ptr;
    let doc = EditDocument::from(c_doc);

    let temp_input = tile_slice.to_vec();
    ImageProcessor::process_rgba_buffer(&temp_input, tile_slice, tile_width, tile_height, &doc);
    0
}

