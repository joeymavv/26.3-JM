/* 26.3-JM desktop — ultra high performance preamble.
 *
 * Injected at the top of <head> of the bundled game HTML at build time.
 * Everything here is defensive: if any single tweak throws, the game still boots.
 */
(function () {
  'use strict';

  var FLAGS = {
    forceHighPerformanceGPU: true,
    desynchronizedCanvas: true,
    allowSoftwareFallback: true,
    disableContextMenu: true,
    keepAudioAlive: true,
  };

  var applied = [];
  function safe(name, fn) {
    try {
      fn();
      applied.push(name);
    } catch (e) {
      try {
        console.warn('[jm263-perf] skipped ' + name + ':', e && e.message);
      } catch (_) {}
    }
  }

  /* ------------------------------------------------------------------
   * 1. Force the discrete / high-performance GPU and a low-latency
   *    presentation path for every WebGL context the game creates.
   * ------------------------------------------------------------------ */
  safe('webgl-context-attributes', function () {
    var targets = [];
    if (typeof HTMLCanvasElement !== 'undefined') targets.push(HTMLCanvasElement.prototype);
    if (typeof OffscreenCanvas !== 'undefined') targets.push(OffscreenCanvas.prototype);

    targets.forEach(function (proto) {
      var original = proto.getContext;
      if (typeof original !== 'function' || original.__jm263Patched) return;

      var patched = function (type, attrs) {
        var t = typeof type === 'string' ? type.toLowerCase() : type;
        var opts = attrs && typeof attrs === 'object' ? Object.assign({}, attrs) : {};

        if (t === 'webgl' || t === 'webgl2' || t === 'experimental-webgl' || t === 'experimental-webgl2') {
          if (FLAGS.forceHighPerformanceGPU) opts.powerPreference = 'high-performance';
          if (FLAGS.allowSoftwareFallback) opts.failIfMajorPerformanceCaveat = false;
          if (opts.preserveDrawingBuffer !== true) opts.preserveDrawingBuffer = false;
          if (FLAGS.desynchronizedCanvas && opts.desynchronized === undefined) opts.desynchronized = true;
          // Opaque backbuffers skip a per-frame compositing blend on macOS.
          if (opts.alpha === undefined) opts.alpha = false;
        } else if (t === '2d') {
          if (FLAGS.desynchronizedCanvas && opts.desynchronized === undefined) opts.desynchronized = true;
        }

        var ctx = original.call(this, type, opts);
        if (!ctx && attrs !== undefined) ctx = original.call(this, type, attrs);
        if (!ctx) ctx = original.call(this, type);
        return ctx;
      };

      patched.__jm263Patched = true;
      proto.getContext = patched;
    });
  });

  /* ------------------------------------------------------------------
   * 2. Keep the render loop at full display rate. WKWebView will happily
   *    clamp timers when it thinks we are idle; a silent rAF heartbeat plus
   *    the native backgroundThrottling=disabled window flag keeps us pinned.
   * ------------------------------------------------------------------ */
  safe('raf-heartbeat', function () {
    var raf = window.requestAnimationFrame;
    if (typeof raf !== 'function') return;
    var beat = function () {
      raf(beat);
    };
    raf(beat);
  });

  /* ------------------------------------------------------------------
   * 3. Report the real core count to the engine's thread-pool sizing.
   * ------------------------------------------------------------------ */
  safe('hardware-concurrency', function () {
    if (!('hardwareConcurrency' in navigator)) {
      Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
    }
  });

  /* ------------------------------------------------------------------
   * 4. Native-app behaviour: no browser context menu, no rubber-band
   *    scrolling, no accidental text selection while playing.
   * ------------------------------------------------------------------ */
  safe('native-feel', function () {
    if (FLAGS.disableContextMenu) {
      window.addEventListener('contextmenu', function (e) { e.preventDefault(); }, { capture: true });
    }
    window.addEventListener(
      'wheel',
      function (e) {
        if (e.ctrlKey || e.metaKey) e.preventDefault(); // block pinch-zoom of the page
      },
      { capture: true, passive: false }
    );
    var style = document.createElement('style');
    style.textContent =
      'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;' +
      'overscroll-behavior:none;-webkit-user-select:none;user-select:none;' +
      '-webkit-touch-callout:none;}' +
      'canvas{image-rendering:pixelated;outline:none;}';
    var attach = function () {
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.head) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
  });

  /* ------------------------------------------------------------------
   * 5. WKWebView suspends AudioContexts aggressively; resume on any input.
   * ------------------------------------------------------------------ */
  safe('audio-resume', function () {
    if (!FLAGS.keepAudioAlive) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var live = [];
    var Patched = function () {
      var inst = new AC(arguments[0]);
      live.push(inst);
      return inst;
    };
    Patched.prototype = AC.prototype;
    window.AudioContext = Patched;
    if (window.webkitAudioContext) window.webkitAudioContext = Patched;

    var resume = function () {
      live.forEach(function (c) {
        if (c.state === 'suspended' && typeof c.resume === 'function') c.resume().catch(function () {});
      });
    };
    ['pointerdown', 'keydown', 'focus'].forEach(function (ev) {
      window.addEventListener(ev, resume, { capture: true });
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) resume();
    });
  });

  /* ------------------------------------------------------------------
   * 6. Persist storage so single-player worlds are never evicted.
   * ------------------------------------------------------------------ */
  safe('persistent-storage', function () {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(function () {});
    }
  });

  /* ------------------------------------------------------------------
   * 7. WebAssembly GC check. The engine requires the WasmGC proposal,
   *    which WKWebView only gained in Safari 18.2 (December 2024) —
   *    i.e. macOS 13 Ventura or newer, fully updated. Without this check
   *    an older system just shows a black window with no explanation.
   * ------------------------------------------------------------------ */
  safe('wasm-gc-check', function () {
    var ok = false;
    try {
      // Smallest module that only validates when WasmGC is enabled:
      // a type section declaring one empty struct (0x5f).
      ok = typeof WebAssembly !== 'undefined' && WebAssembly.validate(
        new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
                        0x01, 0x03, 0x01, 0x5f, 0x00])
      );
    } catch (e) {
      ok = false;
    }

    window.JM263_WASM_GC = ok;
    if (ok) return;

    var show = function () {
      var el = document.createElement('div');
      el.setAttribute('style', [
        'position:fixed', 'inset:0', 'z-index:2147483647',
        'display:flex', 'align-items:center', 'justify-content:center',
        'background:#16103a', 'color:#fff', 'padding:40px',
        'font:16px/1.6 -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif',
        'text-align:center', '-webkit-user-select:text', 'user-select:text',
      ].join(';'));
      el.innerHTML =
        '<div style="max-width:560px">' +
        '<div style="font-size:26px;font-weight:700;margin-bottom:16px">This Mac needs a newer system</div>' +
        '<p>26.3-JM runs on WebAssembly GC, which Apple\u2019s web engine only supports from ' +
        '<b>Safari 18.2</b> onwards (released December 2024).</p>' +
        '<p>Open <b>System Settings \u203a General \u203a Software Update</b> and install the latest updates, ' +
        'then launch 26.3-JM again.</p>' +
        '<p style="opacity:.7;font-size:14px;margin-top:24px">Requires macOS 13 Ventura or newer. ' +
        'On macOS 12 Monterey and earlier, Safari cannot be updated far enough \u2014 ' +
        'play the browser build in Chrome instead.</p>' +
        '</div>';
      document.body.appendChild(el);
    };

    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show, { once: true });
  });

  window.JM263_PERF = {
    version: 1,
    flags: FLAGS,
    applied: applied,
  };

  try {
    console.log('[jm263-perf] ultra high performance mode:', applied.join(', '));
  } catch (_) {}
})();
