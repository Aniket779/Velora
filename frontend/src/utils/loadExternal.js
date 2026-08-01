/**
 * ============================================================================
 * LOAD AN EXTERNAL SCRIPT / STYLESHEET, ONCE
 * ============================================================================
 * Used for Pannellum, the 360° panorama engine behind the VR viewer.
 *
 * WHY NOT JUST npm install IT
 * Pannellum is a UMD bundle that assigns `window.pannellum` — it isn't an ES
 * module, so bundling it means import side-effects and a global that Vite
 * can't tree-shake. It's also needed by exactly one rarely-opened modal, so
 * putting it in the bundle taxes every visitor for a feature most never use.
 *
 * Loading it on demand is the same pattern Google Maps and Stripe.js use, and
 * it removes the dependency (and its peer-version conflicts) entirely.
 *
 * THE TRADE-OFF, stated plainly: this depends on a third-party CDN at runtime.
 * If it's blocked or down, the viewer fails — so the caller gets a rejected
 * promise and shows a real error rather than an empty black box.
 * ============================================================================
 */

// Module-level cache: opening the modal five times must not inject five
// copies of a 100KB script.
const inflight = new Map();

export function loadScript(src) {
  if (inflight.has(src)) return inflight.get(src);

  const promise = new Promise((resolve, reject) => {
    // Survives hot reloads and any other component that already loaded it.
    const existing = document.querySelector(`script[data-external="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)));
      return undefined;
    }

    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.dataset.external = src;
    el.addEventListener('load', () => {
      el.dataset.loaded = 'true';
      resolve();
    });
    el.addEventListener('error', () => {
      // Drop the cache entry so a later retry can actually retry, rather than
      // resolving the same rejected promise forever.
      inflight.delete(src);
      el.remove();
      reject(new Error(`Failed to load ${src}`));
    });
    document.head.appendChild(el);
    return undefined;
  });

  inflight.set(src, promise);
  return promise;
}

export function loadStylesheet(href) {
  if (inflight.has(href)) return inflight.get(href);

  const promise = new Promise((resolve, reject) => {
    if (document.querySelector(`link[data-external="${href}"]`)) return resolve();

    const el = document.createElement('link');
    el.rel = 'stylesheet';
    el.href = href;
    el.dataset.external = href;
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => {
      inflight.delete(href);
      reject(new Error(`Failed to load ${href}`));
    });
    document.head.appendChild(el);
    return undefined;
  });

  inflight.set(href, promise);
  return promise;
}
