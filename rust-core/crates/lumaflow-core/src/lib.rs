pub mod models;
pub mod color;
pub mod pipeline;

pub use models::*;
pub use color::*;
pub use pipeline::*;

/// Version and engine metadata
pub const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const ENGINE_NAME: &str = "Lumaflow Rust Core Engine";
