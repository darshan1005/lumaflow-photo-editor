#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Lumaflow Mobile - Cross-Compile Rust Core Engine for iOS (.xcframework)
# Targets: aarch64-apple-ios (Physical devices), aarch64-apple-ios-sim (Simulator)
# =============================================================================

echo "========================================================"
echo " Lumaflow Mobile - Compiling Rust Native Engine for iOS"
echo "========================================================"

RUST_CORE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../rust-core" && pwd)"
OUTPUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../ios/Frameworks" && pwd)"

mkdir -p "$OUTPUT_DIR"
cd "$RUST_CORE_DIR"

echo "[1/2] Building for aarch64-apple-ios (Device)..."
cargo build --release --target aarch64-apple-ios --package lumaflow-ffi

echo "[2/2] Building for aarch64-apple-ios-sim (Simulator)..."
cargo build --release --target aarch64-apple-ios-sim --package lumaflow-ffi

echo "========================================================"
echo " iOS Rust static libraries built successfully!"
echo "========================================================"
