use rayon::prelude::*;

#[derive(Debug, Clone)]
pub struct HistogramData {
    pub red: [u32; 256],
    pub green: [u32; 256],
    pub blue: [u32; 256],
    pub luma: [u32; 256],
}

impl Default for HistogramData {
    fn default() -> Self {
        Self {
            red: [0u32; 256],
            green: [0u32; 256],
            blue: [0u32; 256],
            luma: [0u32; 256],
        }
    }
}

impl HistogramData {
    /// Merges another histogram data into this one
    pub fn merge(&mut self, other: &HistogramData) {
        for i in 0..256 {
            self.red[i] += other.red[i];
            self.green[i] += other.green[i];
            self.blue[i] += other.blue[i];
            self.luma[i] += other.luma[i];
        }
    }

    /// Fast parallel histogram calculation across RGBA pixel buffer
    pub fn compute_parallel(rgba_pixels: &[u8]) -> Self {
        const CHUNK_SIZE: usize = 16384 * 4; // 16k pixels per chunk

        rgba_pixels
            .par_chunks(CHUNK_SIZE)
            .fold(
                HistogramData::default,
                |mut acc, chunk| {
                    let mut i = 0;
                    while i + 3 < chunk.len() {
                        let r = chunk[i] as usize;
                        let g = chunk[i + 1] as usize;
                        let b = chunk[i + 2] as usize;

                        // Rec.709 luma integer approximation
                        // (2126 * r + 7152 * g + 722 * b) / 10000
                        let luma = (2126 * r + 7152 * g + 722 * b) / 10000;
                        let luma_clamped = luma.min(255);

                        acc.red[r] += 1;
                        acc.green[g] += 1;
                        acc.blue[b] += 1;
                        acc.luma[luma_clamped] += 1;

                        i += 4;
                    }
                    acc
                },
            )
            .reduce(
                HistogramData::default,
                |mut a, b| {
                    a.merge(&b);
                    a
                },
            )
    }
}
