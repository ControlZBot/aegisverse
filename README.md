# Aegisverse

Incremental upgrade of a 3D particle + universe sandbox built on TypeScript + Vite + Three.js.

## Run

```bash
npm install
npm run dev
npm run build
npm test
```

## What is included
- Stable + Advanced simulation modes sharing the same UI.
- Worker-based fixed timestep simulation with health monitor and rollback safety.
- XPBD-style particle constraints, capped SPH-lite fluids, bounded deterministic reactions.
- Rigid broadphase + impulse solver + CCD check for fast objects.
- 150+ elements with deterministic reaction rules and registry validation.
- Rendering with LOD split (instanced near particles + far point sprites), procedural textures, and debug overlays.
- Regression test suite using JSON scenes for 10-second invariants.
