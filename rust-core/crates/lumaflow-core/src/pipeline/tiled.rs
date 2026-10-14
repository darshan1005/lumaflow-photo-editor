use crate::models::EditDocument;
use crate::pipeline::processor::ImageProcessor;

#[derive(Debug, Clone, Copy)]
pub struct TileBounds {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

pub struct TiledProcessor {
    pub tile_size: u32,
}

impl Default for TiledProcessor {
    fn default() -> Self {
        Self { tile_size: 2048 } // 2048x2048 = 16MB per RGBA tile (strictly within budget)
    }
}

impl TiledProcessor {
    pub fn new(tile_size: u32) -> Self {
        Self { tile_size }
    }

    /// Calculates tile boundaries for a high-res image (e.g., 8000x6000 48MP)
    pub fn calculate_tiles(&self, full_width: u32, full_height: u32) -> Vec<TileBounds> {
        let mut tiles = Vec::new();
        let mut y = 0;
        while y < full_height {
            let tile_h = (self.tile_size).min(full_height - y);
            let mut x = 0;
            while x < full_width {
                let tile_w = (self.tile_size).min(full_width - x);
                tiles.push(TileBounds {
                    x,
                    y,
                    width: tile_w,
                    height: tile_h,
                });
                x += self.tile_size;
            }
            y += self.tile_size;
        }
        tiles
    }

    /// Process a single tile buffer in-place
    pub fn process_tile(
        &self,
        tile_pixels: &mut [u8],
        bounds: &TileBounds,
        doc: &EditDocument,
    ) {
        let input_clone = tile_pixels.to_vec();
        ImageProcessor::process_rgba_buffer(&input_clone, tile_pixels, bounds.width, bounds.height, doc);
    }
}
