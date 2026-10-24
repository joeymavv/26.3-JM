# Loading custom worlds

The packaged clients can import worlds. This is a guide to getting big
downloaded maps into them, and to the two things that actually go wrong.

---

## The short version

*Singleplayer → Create New World → Load EPK / Load World Backup → pick the file.*

Eaglercraft's native world format is **`.epk`**. Some builds also accept a vanilla
world exported as `.zip`. Check your client's import menu — if it offers a ZIP
option, you can skip the conversion step below entirely.

The format is symmetric, so nothing you build is trapped: select a world →
**Backup** → **Export as EPK**, and that file can be re-imported on any other
Eaglercraft build, or decompiled back into a real Minecraft save.

---

## Converting a vanilla map to `.epk`

1. Download the map and unzip it. You want the folder that directly contains
   `level.dat` and a `region/` directory — not a wrapper folder around it.
2. Repack it with one of these browser tools (nothing to install):
   - **ayunWebEPK** by ayunami2000 — compiles and decompiles EPK files
   - **Eaglercraft Save Editor** by ayqshi — also parses the `.dat` NBT into
     readable JSON, handy if an import fails and you want to see why
3. Import the resulting `.epk` through the menu above.

---

## The two things that go wrong

### 1. Size

Worlds live in the webview's IndexedDB, not in a folder on disk you control.
Large maps are the main failure mode.

| Map size | What to expect |
| --- | --- |
| under ~100 MB | fine |
| 100–300 MB | slow import, usually works |
| 300 MB+ | may fail outright or take several minutes |

The desktop app has a considerably more generous storage quota than the same
client running in a browser tab, which is a real advantage here. On top of that,
`scripts/perf-preamble.js` calls `navigator.storage.persist()` at startup, so the
OS marks the data persistent and won't quietly evict your worlds when disk space
runs low.

**Prove the pipeline with a small map before you spend an hour on a 600 MB one.**

### 2. Version gap

Most of the great city maps were built for 1.8–1.12. A 26.3 client has to run
them through Minecraft's world upgrader on first load. That usually works, but
it can take a long time on a big map and occasionally mangles older blocks and
entities.

Keep the original download. If a world imports badly, that `.zip` is your only
way back.

---

## Maps worth trying

Ordered so the safe ones come first.

| Map | What it is | Size |
| --- | --- | --- |
| **Large Futuristic City** (MinecraftWorkshop) | Finished, compact, neon-future. Good first test | Small |
| **Tax' Future City** (Taknax) | Straight sci-fi futurism | Small |
| **Tideworn** | 8 km² flooded abandoned city. Eerie and very explorable | Medium |
| **XKing Supreme City** | 100+ skyscrapers, all furnished inside | Medium |
| **Mattupolis** | Seattle/Vancouver towers blended into real terrain | Medium |
| **City of Waterton** | Extremely large modern city, built for 1.12 — good version match | Large |
| **Greenfield** (THEJESTR) | The big one. LA-inspired, 1:1 scale, 400+ builders over 9 years, subways, ports, malls. Largest city ever built in Minecraft | ~600 MB |

Sources: Planet Minecraft and CurseForge. Greenfield also ships an official
resource pack — the map looks wrong without it, since it leans on custom
textures for signage and detailing. Resource packs import as `.zip` through the
normal in-game menu.

---

## Back up your worlds

Browser-backed storage can disappear: a cleared cache, a profile reset, an
uninstall. Export anything you care about as an `.epk` and keep it somewhere
real. `navigator.storage.persist()` reduces the risk; it does not remove it.
