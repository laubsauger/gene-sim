#!/bin/bash

# Setup script for gene-sim development

echo "🧬 Gene Sim Setup Script"
echo "========================"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check for Yarn
if ! command -v yarn &> /dev/null; then
    echo "❌ Yarn is not installed. Installing Yarn..."
    corepack enable
    corepack prepare yarn@stable --activate
fi

# Install dependencies
echo "📦 Installing dependencies..."
yarn install

# Check for Rust (optional for WASM)
echo ""
echo "🦀 Checking for Rust and wasm-pack (optional for WASM acceleration)..."

if ! command -v cargo &> /dev/null; then
    echo "ℹ️  Rust is not installed."
    echo "   WASM acceleration will not be available."
    echo "   To install Rust, visit: https://rustup.rs/"
    WASM_AVAILABLE=false
else
    echo "✅ Rust is installed"
    
    # Check for wasm-pack
    if ! command -v wasm-pack &> /dev/null; then
        echo "ℹ️  wasm-pack is not installed."
        echo "   Installing wasm-pack..."
        curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
    else
        echo "✅ wasm-pack is installed"
    fi
    
    # Try to build WASM
    echo ""
    echo "🔨 Building WASM module..."
    if yarn build:wasm; then
        echo "✅ WASM module built successfully"
        WASM_AVAILABLE=true
    else
        echo "⚠️  WASM build failed, but the app will still work in JS mode"
        WASM_AVAILABLE=false
    fi
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "Available commands:"
echo "  yarn dev        - Start development server (JS mode)"
if [ "$WASM_AVAILABLE" = true ]; then
    echo "  yarn dev:wasm   - Start development server with WASM acceleration"
fi
echo "  yarn build      - Build for production"
if [ "$WASM_AVAILABLE" = true ]; then
    echo "  yarn build:full - Build with WASM for production"
fi
echo ""
echo "Start the development server with: yarn dev"
echo ""