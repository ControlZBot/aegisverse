# Architecture

## Data flow
1. Main thread UI sends tool/settings commands to `sim/worker.ts`.
2. Worker runs fixed-step simulation (`SIM_DT`) and posts compact state snapshots.
3. Renderer consumes state with LOD split:
   - near solids/liquids via instanced mesh
   - far particles via point sprite buffer
4. Autosave/export/import flow uses `shared/serializers.ts`.

## Worker protocol
- `tick`, `pause`, `reset`, `mode`, `quality`, `simSpeed`
- `preset`, `explosion`, `laser`, `ship`, `shipControl`
- `export`, `import`

## Safety
- clamped dt and step cap
- per-step finite checks + rollback to last good state
- health events debounced per event code
