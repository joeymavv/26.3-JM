# 26.3-JM

**Made by Joey-JM**

A custom browser build based on Eaglercraft 26.2 by o_xer, with selected Minecraft 26.3 features backported. This is not a complete official Minecraft 26.3 client.

## Download and play

1. Open [Releases](https://github.com/joeymavv/26.3-JM/releases).
2. Download `26.3-fixed.html` from the release assets.
3. Open it in a modern browser with WebAssembly GC support, such as current Chrome.

The HTML includes the game assets. An internet connection is needed for multiplayer servers. Single-player worlds are stored in the browser; export worlds from the game to back them up.

## Latest fixes

The current release asset is **[26.3-fixed.html](https://github.com/joeymavv/26.3-JM/releases/download/v26.3-jm.1/26.3-fixed.html)**.

- Poplar logs appear with the other logs; the poplar building family follows pale oak.
- Cushions place at the correct height on slabs and stairs, with working selection, seating and save/reload behavior. Supporting blocks stay intact.
- Menu and Credits version labels show **26.3-JM**.
- Startup/loading improvements from the previous update are retained.

See the [release notes](https://github.com/joeymavv/26.3-JM/releases/tag/v26.3-jm.1) for the changes, backups and test scope.

## Included features

- Mouse-wheel camera movement fix.
- Dappled Forest, poplar wood family, leaves, saplings, boats, shelf mushrooms and red shrubs.
- Sixteen colored cushions with seating and safe dismount behavior.
- One-use straw beds that preserve the player's existing respawn point.
- Colored wool and concrete stairs/slabs, recipes and concrete stonecutting.
- Abandoned camps and world-specific exploration-map rewards.
- New items in the appropriate Creative inventory categories.

Normal sound is retained. No No Lag mode is included.

## Compatibility and test coverage

The implementation uses the 26.2 engine, so some behavior differs from native 26.3. A selection of placement, crafting, sleep, seating, world generation, maps and save/reload flows has been tested. Every seed, orientation and multiplayer edge case has not been tested.

Back up your worlds before changing game versions. Do not open worlds containing these new blocks/items with an older build; that older build may discard content it does not recognize. An HTML backup does not back up your worlds.

## Desktop apps (.dmg and .exe)

This repository also builds **26.3-JM as a native desktop application** for macOS and Windows using [Tauri 2](https://v2.tauri.app/), with ultra-high-performance mode enabled. The game HTML is embedded in the app, so it runs offline (multiplayer still needs a connection) and single-player worlds persist in a stable, app-private store.

### Getting the apps

Builds run on GitHub's macOS and Windows runners — you do not need a Mac or a PC.

Copy `BUILD-APPS.yml` from the repo root over `.github/workflows/macos-dmg.yml`.
Committing it starts a build; both platforms build in parallel. When the run finishes,
the **Artifacts** box on the run page holds:

| Artifact | Contents |
| --- | --- |
| `Eagler26-macOS-dmg` | `Eagler26-macOS-universal.dmg` + checksums |
| `Eagler26-Windows-exe` | `Eagler26-Windows-Setup.exe`, `Eagler26-Windows-portable.exe` + checksums |

Open the DMG and drag the app into *Applications*; on Windows run the setup, or just run
the portable `.exe` directly.

The app is not notarised or code-signed. On macOS run
`xattr -dr com.apple.quarantine /Applications/26.3-JM.app`; on Windows click
**More info ▸ Run anyway** at the SmartScreen prompt.

### Which clients get packaged

A build produces **four apps** — both clients, both platforms:

| Artifact | Client | Multiplayer |
| --- | --- | --- |
| `Eaglercraft-26.3-*` | Eaglercraft 26.3, prebuilt by [DhyeyBG](https://github.com/DhyeyBG/Eaglercraft-26.3) | **Eaglercraft `wss://` servers** |
| `26.3-JM-*` | 26.3-JM — Eaglercraft 26.2 + 26.3 backports | **Eaglercraft `wss://` servers** |
| `Gaius-26.3-*` | Gaius 26.3 — official bytecode via TeaVM | Ordinary offline-mode Java servers via RelayNode |

Each row builds a `.dmg` and a `.exe`, so a run produces six artifacts. Delete the
matrix blocks you don't want from `BUILD-APPS.yml` to trim it.

All three clients can import custom worlds. See **[WORLDS.md](WORLDS.md)** for how
to load downloaded maps, and the size and version limits that bite on large ones.

Every client ships under its own bundle identifier, so they all install side by side
and keep **separate world storage**. Install the ones you want and open whichever
matches the server you are joining.

Gaius cannot join Eaglercraft `wss://` servers and 26.3-JM cannot join plain Java
servers — the protocols are different. That is exactly why both are built.

`payloads.json` is the catalogue: URL, size, pinned SHA-256 and app identity for each
client. `scripts/set-payload.mjs <id>` applies one locally:

```bash
node scripts/set-payload.mjs eagler263 # Eaglercraft 26.3 (DhyeyBG)
node scripts/set-payload.mjs jm        # 26.3-JM
node scripts/set-payload.mjs gaius     # Gaius 26.3
node scripts/set-payload.mjs gaius-26.2
GAME_URL=https://example.com/c.html node scripts/set-payload.mjs custom
```

The `custom` payload reads the `GAME_URL` repository variable — use it for a
self-hosted [client.goldhq.net](https://client.goldhq.net/) export, which has no fixed
download URL of its own.

Payloads are verified before bundling: by SHA-256 where upstream publishes one, and by
exact byte size otherwise. The build refuses to package anything that does not match.
When a payload has no pinned hash the build prints the hash it saw, so you can add it
to `payloads.json` afterwards.

### What "ultra high performance" means here

| Layer | Setting | Effect |
| --- | --- | --- |
| macOS | `NSSupportsAutomaticGraphicsSwitching = false` | Pins the app to the discrete/high-power GPU |
| macOS | `LSAppNapIsDisabled = true` | App Nap never throttles the process |
| WKWebView | `backgroundThrottling = "disabled"` | `requestAnimationFrame` and timers keep full rate when occluded |
| WebGL | `powerPreference: "high-performance"`, `desynchronized: true`, `alpha: false`, `preserveDrawingBuffer: false` | High-power GPU, low-latency presentation, no per-frame compositing blend |
| Audio | AudioContext auto-resume | No silent audio after focus loss |
| Storage | `navigator.storage.persist()` | Worlds are never evicted |
| Binary | `lto = "fat"`, `codegen-units = 1`, `opt-level = 3`, `panic = "abort"`, stripped | Fastest, smallest native shell |
| Signing | Hardened runtime off, JIT entitlements on | WebAssembly runs fully JIT-compiled |

### Which macOS versions does this run on?

**macOS 13 Ventura or newer, fully updated.** Universal binary — Apple Silicon and Intel.

The limit is not Tauri, it is Apple's web engine. 26.3-JM runs on **WebAssembly GC**, which WebKit only gained in **Safari 18.2** (December 2024). Because a Tauri app renders through WKWebView, it uses the system's Safari engine, so the system has to be new enough to have it.

| macOS | Can it run 26.3-JM? |
| --- | --- |
| 15 Sequoia / 26 | Yes — ships with Safari 18.2+ |
| 14 Sonoma | Yes, once Safari 18.2+ is installed via Software Update |
| 13 Ventura | Yes, once Safari 18.2+ is installed via Software Update |
| 12 Monterey and older | **No** — Safari cannot be updated to 18.2 on these. Use the browser build in Chrome instead |

If the engine is too old the app shows a plain explanation screen telling you to run Software Update, rather than a black window (`scripts/perf-preamble.js`, WasmGC probe).

### Building it yourself

Requires macOS with Xcode command line tools, [Rust](https://rustup.rs) and Node 20+.

```bash
npm install
npm run dmg          # universal binary -> src-tauri/target/universal-apple-darwin/release/bundle/dmg/
npm run dmg:native   # this machine's architecture only (faster)
npm run dev          # run the app without bundling
```

The 86 MB game payload is **not** committed. `scripts/prepare-game.mjs` downloads it from the pinned release in `game.lock.json`, verifies its SHA-256, injects `scripts/perf-preamble.js` and writes `dist/index.html`, which Tauri embeds (Brotli-compressed) into the binary.

To build against a different or local game file:

```bash
GAME_LOCAL=/path/to/26.3-fixed.html SKIP_SHA_CHECK=1 npm run dmg
```

## Windows app (.exe)

A build produces two Windows files:

| File | What it is |
| --- | --- |
| `26.3-JM-Windows-Setup.exe` | NSIS installer. Installs per-user (no admin prompt), adds a Start Menu entry and an uninstaller. |
| `26.3-JM-Windows-portable.exe` | The bare application. The game is embedded in it — no installer, just run it. |

### Requirements

**Windows 10 1803 or newer**, plus the **Microsoft Edge WebView2 Runtime**. The installer fetches WebView2 silently if it is missing; Windows 11 and most Windows 10 machines already have it. Keep it current — the game needs WebAssembly GC, which is Chromium 119+.

Windows is arguably the better target: WebView2 *is* Chromium, so the engine matches what the game was written against, and there is no Safari-version cliff like on macOS.

Neither `.exe` is code-signed, so SmartScreen shows *"Windows protected your PC"* on first launch. Click **More info ▸ Run anyway**.

### Windows-specific performance settings

WebView2 is launched with:

```
--ignore-gpu-blocklist --enable-gpu-rasterization --enable-zero-copy
--enable-accelerated-2d-canvas --canvas-oop-rasterization --use-angle=d3d11
--disable-background-timer-throttling --disable-renderer-backgrounding
--disable-backgrounding-occluded-windows
```

GPU rasterisation and zero-copy are forced on even when the driver is blocklisted, canvas work is pushed out of process, ANGLE is pinned to D3D11, and all three of Chromium's background-throttling paths — the Windows equivalent of App Nap — are disabled.

### Building it yourself

On Windows with [Rust](https://rustup.rs), Node 20+ and the MSVC build tools:

```bash
npm install
npm run exe
```

Output lands in `src-tauri/target/release/bundle/nsis/`.

### Desktop project layout

```
assets/app-icon.png            source icon (all sizes generated by `npm run icons`)
payloads.json                  catalogue of packageable clients + app identities
scripts/set-payload.mjs        applies one payload to game.lock.json + tauri.conf.json
game.lock.json                 GENERATED - the currently selected payload
scripts/prepare-game.mjs       fetch, verify, inject, emit dist/index.html
scripts/perf-preamble.js       the ultra-high-performance runtime patches
scripts/build-dmg.sh           one-command local macOS build
scripts/enable-ci.sh           installs the CI workflow into .github/workflows/
BUILD-APPS.yml                 GitHub Actions workflow: macOS .dmg + Windows .exe
src-tauri/tauri.conf.json      window, Info.plist, DMG layout, bundle config
src-tauri/entitlements.plist   JIT + network entitlements
src-tauri/src/main.rs          native shell (no custom IPC, no filesystem access)
```

## Credits

- **This custom build: Made by Joey-JM.**
- Based on **Eaglercraft 26.2 by o_xer**.
- Original Eaglercraft 1.12 credits, upstream contributors and dependency notices are preserved in the in-game Credits page.
- Original Minecraft content and assets: **Mojang**.

The Joey-JM credit describes this custom build and does not replace the upstream authors' credits or notices.
