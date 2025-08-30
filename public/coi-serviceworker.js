/*! coi-serviceworker v0.1.7 - Guido Zuidhof and contributors, licensed under MIT */
/*! Mini version for gene-sim - only essential COOP/COEP functionality */

'use strict';

/**
 * This service worker enables Cross-Origin Isolation by adding the necessary headers
 * to all responses. This allows SharedArrayBuffer to work on platforms like GitHub Pages
 * that don't allow setting these headers directly.
 */

const CACHE_NAME = 'gene-sim-coi-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
        return;
    }
    
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.status === 0) {
                    return response;
                }

                const newHeaders = new Headers(response.headers);
                newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
                newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders,
                });
            })
            .catch((e) => console.error(e))
    );
});