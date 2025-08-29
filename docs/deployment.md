# Deployment Guide

## GitHub Pages Deployment

The project is configured to automatically deploy to GitHub Pages when pushing to the `main` branch.

### Automatic Deployment

1. **Push to main branch**:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **GitHub Actions will**:
   - Install Node.js and Yarn
   - Install Rust and wasm-pack
   - Build the WASM module (if Rust is available)
   - Build the TypeScript/React application
   - Deploy to GitHub Pages

3. **Access the deployed app**:
   - URL: `https://[your-username].github.io/gene-sim/`

### Manual Deployment

If you need to deploy manually:

```bash
# Build everything including WASM
yarn build:all

# Or build without WASM (JavaScript fallback)
yarn build

# Preview locally
yarn preview
```

## Configuration

### GitHub Pages Settings

1. Go to repository Settings → Pages
2. Source: Deploy from a branch
3. Branch: `gh-pages` (created by GitHub Actions)
4. Path: `/` (root)

### CORS Headers

The app requires these headers for SharedArrayBuffer:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

These are configured in:
- `vite.config.ts` for development
- GitHub Pages serves with appropriate headers

## Build Modes

### With WASM (Recommended)

Requires Rust toolchain installed:

```bash
# One-time setup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Build
yarn build:all
```

**Performance**: 2-3x faster simulation

### Without WASM (Fallback)

Works without Rust:

```bash
yarn build
```

**Performance**: Standard JavaScript speed

### Multi-Worker Mode

Automatically enabled when:
- WASM is available
- Browser has 4+ CPU cores
- SharedArrayBuffer is supported

**Performance**: 4-8x faster with 4+ cores

## Troubleshooting

### WASM Module Not Loading

1. **Check browser console** for errors
2. **Verify COOP/COEP headers** are set
3. **Ensure HTTPS** (or localhost for dev)
4. **Check browser support**:
   - Chrome 68+
   - Firefox 79+
   - Safari 15.4+

### SharedArrayBuffer Not Available

- **Production**: Should work on GitHub Pages
- **Local**: Requires secure context (HTTPS or localhost)
- **Headers**: Must have COOP/COEP headers

### Build Failures

#### Rust/WASM errors
- The build gracefully falls back to JS
- Check `wasm/build.sh` output
- Verify Rust is installed: `rustc --version`

#### TypeScript errors
- Run `yarn tsc --noEmit` to check types
- Fix any type errors before building

### Performance Issues

1. **Check simulation mode** in UI (JS/WASM/Multi-Worker)
2. **Verify WASM loaded**: Check console for "[WASM] Module loaded successfully"
3. **Check CPU cores**: `navigator.hardwareConcurrency`
4. **Monitor performance**: Use built-in performance graph

## Environment Variables

- `NODE_ENV`: Set to `production` for optimized builds
- `PUBLIC_URL`: Base path for deployment (auto-set for GitHub Pages)

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/deploy.yml`):

1. **Triggers**: Push to main, manual dispatch
2. **Build steps**:
   - Setup Node.js 20
   - Setup Rust (stable)
   - Install wasm-pack
   - Cache dependencies
   - Build WASM module
   - Build application
   - Deploy to Pages

3. **Caching**: 
   - Rust dependencies
   - Node modules
   - WASM build artifacts

## Monitoring Deployment

1. **GitHub Actions**: Check Actions tab for build status
2. **Pages Deployment**: Settings → Pages shows deployment status
3. **Console Logs**: App logs mode and performance metrics
4. **Performance Graph**: Built-in monitoring in the app

## Rollback

If deployment fails:

1. **Revert commit**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Manual deployment** of previous version:
   ```bash
   git checkout [previous-commit]
   yarn build
   # Deploy dist/ folder manually
   ```

## Security Notes

- WASM modules are sandboxed
- SharedArrayBuffer requires secure context
- No secrets in client-side code
- All simulation runs locally in browser