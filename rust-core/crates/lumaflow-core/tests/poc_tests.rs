use lumaflow_core::{
    EditDocument, ImageProcessor, TiledProcessor
};

#[test]
fn test_poc_1_neutral_document_preserves_pixels() {
    let doc = EditDocument::new("test_asset_1", "file://sample.jpg");

    // 4x4 test pixel buffer (RGBA) with middle gray 128
    let mut pixels = vec![0u8; 4 * 4 * 4];
    for i in (0..pixels.len()).step_by(4) {
        pixels[i] = 128;     // R
        pixels[i + 1] = 128; // G
        pixels[i + 2] = 128; // B
        pixels[i + 3] = 255; // A
    }

    let processed = ImageProcessor::process_to_vec(&pixels, 4, 4, &doc);

    assert_eq!(processed.len(), pixels.len());
    // Middle gray with 0 exposure, contrast, WB must remain ~128 (+/- 2 rounding bounds)
    assert!((processed[0] as i32 - 128).abs() <= 2);
    assert!((processed[1] as i32 - 128).abs() <= 2);
    assert!((processed[2] as i32 - 128).abs() <= 2);
    assert_eq!(processed[3], 255);
}

#[test]
fn test_poc_2_radiometric_exposure_adjustment() {
    let mut doc_plus1 = EditDocument::new("test_asset_1", "file://sample.jpg");
    doc_plus1.basic.exposure = 1.0; // +1 Stop (2x radiometric energy)

    let mut doc_minus1 = EditDocument::new("test_asset_1", "file://sample.jpg");
    doc_minus1.basic.exposure = -1.0; // -1 Stop (0.5x radiometric energy)

    let input_pixels = [128u8, 128, 128, 255];

    let result_plus = ImageProcessor::process_to_vec(&input_pixels, 1, 1, &doc_plus1);
    let result_minus = ImageProcessor::process_to_vec(&input_pixels, 1, 1, &doc_minus1);

    // +1 EV must be significantly brighter than 128 (> 170)
    assert!(result_plus[0] > 170);
    assert!(result_plus[1] > 170);
    assert!(result_plus[2] > 170);

    // -1 EV must be significantly darker than 128 (< 95)
    assert!(result_minus[0] < 95);
    assert!(result_minus[1] < 95);
    assert!(result_minus[2] < 95);

    // Must not be identical to input
    assert_ne!(result_plus[0], input_pixels[0]);
    assert_ne!(result_minus[0], input_pixels[0]);
}

#[test]
fn test_poc_3_temperature_color_balance() {
    let mut doc_warm = EditDocument::new("test_asset_1", "file://sample.jpg");
    doc_warm.basic.temperature = 40.0; // Warm amber shift
    doc_warm.basic.saturation = 20.0;

    let input_pixels = [128u8, 128, 128, 255];
    let processed = ImageProcessor::process_to_vec(&input_pixels, 1, 1, &doc_warm);

    // Warmer image must boost Red channel (> 128) and attenuate Blue channel (< 128)
    assert!(processed[0] > 128, "Red must be boosted, got {}", processed[0]);
    assert!(processed[2] < 128, "Blue must be attenuated, got {}", processed[2]);
}

#[test]
fn test_poc_4_histogram_computation() {
    let pixels = vec![
        100, 150, 200, 255,
        50,  50,  50,  255,
        255, 0,   128, 255,
        100, 150, 200, 255,
    ];

    let hist = ImageProcessor::compute_histogram(&pixels);

    assert_eq!(hist.red[100], 2);
    assert_eq!(hist.red[50], 1);
    assert_eq!(hist.red[255], 1);
    assert_eq!(hist.green[150], 2);
    assert_eq!(hist.blue[200], 2);
}

#[test]
fn test_poc_5_tiled_processing_subdivision() {
    let tiled = TiledProcessor::new(2048);
    // 8000 x 6000 (48 Megapixels)
    let tiles = tiled.calculate_tiles(8000, 6000);

    // 8000 / 2048 = 4 cols (2048, 2048, 2048, 1856)
    // 6000 / 2048 = 3 rows (2048, 2048, 1904)
    // Total tiles = 4 * 3 = 12 tiles
    assert_eq!(tiles.len(), 12);
    assert_eq!(tiles[0].width, 2048);
    assert_eq!(tiles[0].height, 2048);
    assert_eq!(tiles[3].width, 1856);
    assert_eq!(tiles[11].width, 1856);
    assert_eq!(tiles[11].height, 1904);
}

#[test]
fn test_poc_6_1080p_high_throughput_benchmark() {
    let mut doc = EditDocument::new("test_1080p", "file://test.jpg");
    doc.basic.exposure = 0.5;
    let width = 1920;
    let height = 1080;
    let pixels = vec![128u8; (width * height * 4) as usize];
    let mut output = vec![0u8; pixels.len()];

    // Warm up the Rayon thread pool to avoid measuring initialization overhead
    ImageProcessor::process_rgba_buffer(&pixels[0..16], &mut output[0..16], 2, 2, &doc);

    let start = std::time::Instant::now();
    ImageProcessor::process_rgba_buffer(&pixels, &mut output, width, height, &doc);
    let duration = start.elapsed();

    println!("1080p Frame Processing Time (Rust Rayon): {:?}", duration);
    // In release mode on virtualized/CI runners (2 vCPUs), allow up to 250ms; in debug mode, up to 1000ms.
    let max_allowed_ms = if cfg!(debug_assertions) { 1000 } else { 250 };
    assert!(
        duration.as_millis() < max_allowed_ms,
        "1080p took too long: {:?} (max allowed: {}ms)",
        duration,
        max_allowed_ms
    );
    // Verify output buffer was actually transformed
    assert_ne!(output[0], 0);
    assert_ne!(output[0], pixels[0]);
}
