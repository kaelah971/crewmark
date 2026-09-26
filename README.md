# CREW//MARK

> A GTA VI-inspired playable visual-forgery experience where the image you create in Unlayer becomes a physical disguise in the world — and eventually becomes evidence against you.

---

## What It Does

CREW//MARK is a cinematic, playable web vertical slice connecting creative image editing with physical gameplay consequences:

1. **Playable 305 Hub**: Walk the nighttime industrial yard at 305 Print & Sign in full 2.5D movement.
2. **JOB//01 Work Order**: Inspect the after-hours terminal to accept **PORT VICE // NIGHT DELIVERY**.
3. **Forgery Bay (COVER//01)**: Enter the print shop and use the real `@unlayer/react-image-editor` to design a believable maintenance contractor disguise on blank vinyl stock.
4. **Deterministic Visual Check**: Run pixel-derived heuristics (coverage, stripe position, contrast, palette variation, weathering) to evaluate contractor believability.
5. **Print & Apply Sequence**: Watch the exact player-designed disguise applied onto the parked crew vehicle.
6. **Playable Port Vice Checkpoint Mission**: Drive the vehicle down the wet service road approaching Port Vice security.
7. **Security Visual Profile Scan**: Stop at the security line. Cameras scan the vehicle's exact side panel and evaluate the stored cover metrics.
8. **Deterministic Checkpoint Outcomes**:
   - **CLEAN**: Low scrutiny, green booth light, barrier opens quickly (`HEAT +3`).
   - **SECONDARY**: Heightened scrutiny, amber booth light, camera lingers (`HEAT +8`).
   - **MANUAL**: Profile mismatch, red light, barrier holds; player must reverse into auxiliary lane to obtain temporary access (`HEAT +15`).
9. **Restricted Yard & Package Delivery**: Drive through the gate into the cargo yard, park in the delivery zone, and deliver the contraband.
10. **Camera Receipts**: Return to the 305 hub to discover city surveillance cameras captured the vehicle. Review diegetic CCTV frames (`CAM//01`, `CAM//02`, `CAM//03`) correlating the exact player disguise across the city.
11. **COVER//01 Burned**: Visual signature added to watchlist; **HEAT +10** applied. The vehicle disguise is now compromised.
12. **Signature Rotation (COVER//02)**: Re-enter Forgery Bay to rotate the disguise. Seeded from the burned cover, design a new visual profile.
13. **Deterministic Signature Comparison**: Run visual distance comparison across 64-bin color distribution, 4×2 spatial zone layout, and surface complexity. Distance must be $\ge 20\%$ to break correlation and allow locking.
14. **COVER//02 Active**: Strip old vinyl, print new profile, and mount the rotated disguise on the vehicle with reduced city match correlation.

---

## Why the Editor Is Core

The image editor is **not a cosmetic avatar customizer**. It is the central gameplay mechanic:

1. **Physical World Presence**: The exact raster artifact designed in Unlayer is projected dynamically onto the vehicle side panel in both the hub and the playable driving mission.
2. **Deterministic Gameplay Branching**: Mission checkpoint security scans the player's actual cover analysis. Score, stripe placement, and identity signal determine physical gate responses (clean vs secondary vs manual reroute).
3. **Evidence Generation**: Surveillance camera receipts capture the exact player-made artwork in historical CCTV feeds.
4. **Counter-Surveillance Through Design**: Once burned, the player must use visual design principles (color inversion, layout reorganization, code modification) to reduce correlation against their own prior design.

---

## Controls

### World & Driving Controls
| Key | Action |
|---|---|
| `W` / `Up Arrow` | Walk / Accelerate vehicle forward |
| `S` / `Down Arrow` | Walk / Brake / Reverse vehicle |
| `A` / `Left Arrow` | Walk left / Steer vehicle left into secondary lane |
| `D` / `Right Arrow` | Walk right / Steer vehicle right |
| `E` | Interact with marked hotspots (Terminal, Print Shop, Vehicle, Gate) / Deliver package |
| `Escape` | Dismiss work orders / Close CCTV trace modal |

### Editor Controls
- **Filter**: Presets (Invert, Grayscale, Sepia, etc.) and color adjustments.
- **Text & Shapes**: Add contractor wordmarks, fleet IDs, stripes, and badges.
- **Draw**: Freehand weathering, grime, and custom marks.
- **Run Visual Check / Run Signature Check**: Evaluate believability and visual signature distance.
- **Lock Cover**: Commit validated disguise to vehicle.

---

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 8
- **Image Editor**: `@unlayer/react-image-editor` (v1.0.2)
- **Styling**: Tailored CREW//MARK Design System (asphalt, bleached, signal-lime, heat-red, surveillance-blue)
- **Motion**: `motion` (v13) + CSS 2.5D perspective engine
- **Testing**: Vitest (205 unit & integration tests)
- **Linter**: Oxlint (0 errors)
---

## Local Setup

### Prerequisites
- Node.js `^20.19.0` or `>=22.12.0` (required by Vite 8.3.0's `engines.node` declaration)
- npm or pnpm

### Installation & Run
```bash
# 1. Install dependencies
npm install

# 2. Run test suite
npm test

# 3. Start development server
npm run dev

# 4. Or build and preview production bundle
npm run build
npm run preview
```

---

## Architecture

- **World Engine (`src/world/`)**: Lightweight 2.5D perspective controller simulating vehicle forward progress (`dist`), lane offset (`lane`), clamping bounds, stop zones (`STOP_ZONE: 78..86`), and delivery zones (`DELIVERY_ZONE: 122..130`).
- **Cover Storage (`src/lib/coverStorage.ts`)**: Independent persistent storage slots for `COVER//01` and `COVER//02` with pure active-cover resolution (`resolveActiveCover`). Historical `COVER//01` remains immutable.
- **Mission Snapshot Contract (`src/world/mission.ts`)**: `startMissionState(cover)` creates an immutable snapshot of the cover artifact and analysis at the moment of dispatch. Re-editing or rotating later cannot alter past mission history.
- **Receipts Model (`src/world/receipts.ts`)**: Pure deterministic generator producing 3 surveillance receipts from the mission snapshot, with confidence scaled by checkpoint scrutiny (`clean`: 74%, `secondary`: 86%, `manual`: 94%).
- **Signature Comparison Engine (`src/lib/signatureComparison.ts`)**: Computes coarse 64-bin color histograms normalized across all sampled pixels, 4×2 spatial zone layout densities, and edge complexity gradients. Enforces $\ge 20\%$ distance threshold and non-blank vinyl guard (`canLockCover`).

---

## 3D Asset Licensing & Attribution (P7B Prototype)

The isolated `/3d-yard` prototype integrates generic, open-source 3D models:

1. **Generic Service Sedan (`public/models/sedan.glb`)**:
   - **Model**: *Car Concept* Showcase Asset
   - **Creators**: Eric Chadwick (Darmstadt Graphics Group GmbH) & The Khronos Group
   - **Source**: [KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept)
   - **License**: Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/))
   - **Attribution**: © 2015 Khronos Group, © 2024 Darmstadt Graphics Group GmbH.

2. **Industrial Warehouse (`public/models/warehouse.glb`)**:
   - **Source**: [Microsoft Experimental PCF Control Assets](https://github.com/microsoft/experimental-pcf-control-assets)
   - **License**: MIT License ([MIT](https://opensource.org/licenses/MIT))
   - **Attribution**: © Microsoft Corporation.

---

## Challenge Notes

- **Original Assets**: All visual scene plates (`port-vice-checkpoint.png`, `yard-wide.png`, `crewmark-landing-scene.png`) and vehicle cutouts (`service-vehicle.png`) are original/generated for this project. No Rockstar Games or Grand Theft Auto proprietary assets are used.
- **Editor Autonomy**: The application integrates the official `@unlayer/react-image-editor` npm package directly, reading flattened canvas outputs through verified Unlayer APIs (`onSave` and `getImage()`).
