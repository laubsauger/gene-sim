#!/bin/bash

# Build script for WASM module with graceful fallback

echo "Building WASM module..."

# Try to build with wasm-pack
if command -v wasm-pack &> /dev/null; then
    echo "wasm-pack found, building WASM module..."
    
    # Build without wasm-opt first, then optimize manually with correct flags
    if wasm-pack build --target web --out-dir pkg --release --no-opt; then
        echo "Running wasm-opt with correct flags..."
        # Check if wasm-opt is available
        if command -v wasm-opt &> /dev/null; then
            wasm-opt pkg/gene_sim_core_bg.wasm \
                -O3 \
                --enable-bulk-memory \
                --enable-nontrapping-float-to-int \
                -o pkg/gene_sim_core_bg_opt.wasm
            if [ $? -eq 0 ]; then
                mv pkg/gene_sim_core_bg_opt.wasm pkg/gene_sim_core_bg.wasm
                echo "wasm-opt successful!"
            else
                echo "wasm-opt failed, using unoptimized version"
            fi
        else
            echo "wasm-opt not found, using unoptimized version"
        fi
        echo "WASM build successful!"
        
        # Copy the generated files to the src directory
        echo "Copying WASM files to src/wasm..."
        mkdir -p ../src/wasm
        cp pkg/gene_sim_core_bg.wasm ../src/wasm/ 2>/dev/null || true
        cp pkg/gene_sim_core.js ../src/wasm/ 2>/dev/null || true
        cp pkg/gene_sim_core.d.ts ../src/wasm/ 2>/dev/null || true
        
        echo "WASM files copied to src/wasm/"
    else
        echo "WARNING: WASM build failed, simulation will use JavaScript fallback"
        exit 0  # Don't fail the build
    fi
else
    echo "WARNING: wasm-pack not found, skipping WASM build"
    echo "Install with: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"
    exit 0  # Don't fail the build
fi

echo "Build script complete!"