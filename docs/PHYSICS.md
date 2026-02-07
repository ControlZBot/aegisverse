# Physics

## Hybrid solver
- Rigid bodies: broadphase grid + impulse contact solve + friction + CCD overlap check.
- Particles: XPBD-style distance constraints with compliance per phase.
- Fluids: SPH-lite density/pressure + viscosity + XSPH smoothing.

## Thermodynamics
- Conductive transfer across local neighbors.
- Radiative heating from luminous bodies.
- Phase transitions include hysteresis and latent heat budget adjustments.

## Invariants
- No NaNs/infinities.
- Velocity and temperature clamped to configured limits.
- Particle count capped by quality preset.
