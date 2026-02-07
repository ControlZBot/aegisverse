# Performance

## Presets
- Low / Medium / High / Ultra control particle cap, neighbors, solver iters, reaction and fragment caps, and LOD distances.

## Rendering
- Reused typed arrays for particle buffers.
- LOD split reduces near/far rendering cost.
- Worker simulation keeps main thread responsive.

## Limits
- Stable mode is default and conservative.
- Advanced mode enables richer behavior with higher runtime cost.
