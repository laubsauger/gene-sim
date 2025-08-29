# WebAssembly Module for Gene Sim

This directory contains the Rust/WebAssembly implementation of performance-critical simulation components.

## Prerequisites

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### Install wasm-pack

```bash
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
```

### Add WebAssembly target

```bash
rustup target add wasm32-unknown-unknown
```

## Building

### Build WASM module

```bash
# From the wasm directory
wasm-pack build --target web --out-dir pkg

# Or from project root
yarn build:wasm
```

### Build with optimizations

```bash
wasm-pack build --target web --out-dir pkg --release
```

### Build with SIMD support (experimental)

```bash
RUSTFLAGS="-C target-feature=+simd128" wasm-pack build --target web --out-dir pkg --release --features simd
```

## Architecture

The WASM module implements:

- **Spatial Hash**: Grid-based spatial partitioning for neighbor queries
- **Movement System**: Flocking, hunting, and steering behaviors
- **Physics Integration**: Velocity clamping and position updates

Data is passed via typed arrays with zero-copy SharedArrayBuffer views.

## Performance

Expected speedup over JavaScript:

- Movement calculations: 2.5-3x faster
- Spatial hash operations: 3x faster
- Physics integration: 3x faster
- Overall: 2-4x improvement for simulation hot paths

## Development

### Run tests

```bash
cargo test
```

### Check for issues

```bash
cargo clippy
```

### Format code

```bash
cargo fmt
```

## Troubleshooting

### Module not loading

- Ensure COOP/COEP headers are set (check vite.config.ts)
- Verify SharedArrayBuffer is available
- Check browser console for WASM errors

### Performance not improved

- Ensure release build with optimizations
- Check that data copying is minimized
- Verify WASM module is actually being used (check console logs)

### Build failures

- Update Rust: `rustup update`
- Clean build: `cargo clean`
- Check Cargo.toml dependencies
