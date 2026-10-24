// 26.3-JM — native desktop shell.
//
// The entire game is a single self-contained HTML document that is embedded
// into this binary at compile time (see `build.frontendDist` in tauri.conf.json).
// This shell deliberately exposes no Tauri commands and no filesystem access:
// the game runs exactly as it does in a browser, just with native-grade
// window, GPU and scheduling behaviour.
//
// Performance-relevant settings live in `tauri.conf.json`:
//   * window.backgroundThrottling = "disabled"  -> WKWebView never clamps rAF/timers
//   * Info.plist LSAppNapIsDisabled             -> macOS never naps the process
//   * Info.plist NSSupportsAutomaticGraphicsSwitching = false -> discrete GPU
//   * scripts/perf-preamble.js                  -> high-performance WebGL contexts

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("fatal error while running 26.3-JM");
}
