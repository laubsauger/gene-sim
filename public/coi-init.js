/**
 * Initialize Cross-Origin Isolation for SharedArrayBuffer support on GitHub Pages
 * This handles the service worker registration and page reload if needed
 */

(function() {
    // Only proceed if we're not already isolated
    if (window.crossOriginIsolated) {
        console.log('[COI] Already cross-origin isolated');
        return;
    }

    // Check if we're in production (not localhost)
    const hostname = window.location.hostname;
    const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1';
    
    if (!isProduction) {
        console.log('[COI] Running locally, headers should be set by dev server');
        return;
    }

    // Check for service worker support
    if (!('serviceWorker' in navigator)) {
        console.warn('[COI] Service workers not supported, SharedArrayBuffer will not be available');
        return;
    }

    // Determine the base path for GitHub Pages
    const basePath = '/gene-sim/';
    
    // Register the COI service worker
    const swUrl = basePath + 'coi-serviceworker.min.js';
    
    navigator.serviceWorker.register(swUrl, { scope: basePath })
        .then(registration => {
            console.log('[COI] Service worker registered:', registration.scope);
            
            // Check if we need to reload
            const waitForActivation = () => {
                if (registration.active && !window.crossOriginIsolated) {
                    // Add a query parameter to force reload and prevent infinite loops
                    const url = new URL(window.location);
                    if (!url.searchParams.has('coi')) {
                        url.searchParams.set('coi', '1');
                        console.log('[COI] Reloading with COI enabled...');
                        window.location.href = url.toString();
                    }
                }
            };
            
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            
            if (registration.active) {
                waitForActivation();
            } else {
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'activated') {
                            waitForActivation();
                        }
                    });
                });
            }
        })
        .catch(err => {
            console.error('[COI] Service worker registration failed:', err);
        });

    // Handle controller change
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!window.crossOriginIsolated) {
            const url = new URL(window.location);
            if (!url.searchParams.has('coi')) {
                url.searchParams.set('coi', '1');
                console.log('[COI] Controller changed, reloading...');
                window.location.href = url.toString();
            }
        }
    });
})();