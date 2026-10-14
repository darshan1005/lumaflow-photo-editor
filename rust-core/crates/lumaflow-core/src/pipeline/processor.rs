use rayon::prelude::*;
use crate::models::EditDocument;
use crate::pipeline::adjustments::PreparedPipelineContext;
use crate::pipeline::histogram::HistogramData;

pub struct ImageProcessor;

impl ImageProcessor {
    /// Process an RGBA pixel buffer in-place or from input into output in parallel
    pub fn process_rgba_buffer(
        input: &[u8],
        output: &mut [u8],
        width: u32,
        height: u32,
        doc: &EditDocument,
    ) {
        assert_eq!(input.len(), output.len());
        assert_eq!(input.len(), (width * height * 4) as usize);

        let ctx = PreparedPipelineContext::from_document(doc);

        // Process in 4-byte pixel chunks in parallel across Rayon worker threads
        output
            .par_chunks_exact_mut(4)
            .enumerate()
            .for_each(|(i, out_pixel)| {
                let in_idx = i * 4;
                let r_in = input[in_idx];
                let g_in = input[in_idx + 1];
                let b_in = input[in_idx + 2];
                let a_in = input[in_idx + 3];

                let (r_out, g_out, b_out) = ctx.process_pixel(r_in, g_in, b_in);

                out_pixel[0] = r_out;
                out_pixel[1] = g_out;
                out_pixel[2] = b_out;
                out_pixel[3] = a_in; // preserve alpha
            });
    }

    /// Convenience method to allocate a new Vec<u8> and process
    pub fn process_to_vec(
        input: &[u8],
        width: u32,
        height: u32,
        doc: &EditDocument,
    ) -> Vec<u8> {
        let mut output = vec![0u8; input.len()];
        Self::process_rgba_buffer(input, &mut output, width, height, doc);
        output
    }

    /// Process and calculate histogram simultaneously in a single pass or post-pass
    pub fn compute_histogram(rgba_pixels: &[u8]) -> HistogramData {
        HistogramData::compute_parallel(rgba_pixels)
    }
}
