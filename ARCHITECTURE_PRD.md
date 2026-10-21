# Architecture PRD: Go/WebAssembly Migration

**Status:** Draft  
**Audience:** Product, frontend, and engineering contributors  
**Purpose:** Describe the current application and define requirements for a future migration of its calculation engine to Go and WebAssembly.

## 1. Summary

Laminate Layout Calculator is a client-side application for designing randomized staggered laminate-flooring layouts in rectangular rooms. Users enter room and plank dimensions, layout constraints, optional cutouts, and optional manual row starters. The application generates a seeded layout, visualizes it, reports material estimates and warnings, and allows layouts to be saved in browser storage.

The application is currently a Vue 3 and TypeScript single-page application. Layout generation, geometry helpers, summary calculations, and saved-layout persistence are TypeScript modules. The proposed migration is to move the calculation domain into a Go package compiled to WebAssembly while retaining the browser-based user experience. This document records current behavior as the compatibility baseline; it does not assume that implementation or interface decisions for the migration have already been made.

## 2. Product goals

- Preserve the existing room-input, layout-generation, visualization, summary, and saved-layout workflows.
- Move calculation responsibilities to a Go implementation that can run in the browser as WebAssembly.
- Keep the application usable as a static, client-side site without requiring a calculation server.
- Make calculation behavior reproducible for a given input and seed.
- Keep rendering and browser-specific responsibilities separate from the calculation engine.

### Out of scope

- Replacing Vue or redesigning the user interface.
- Adding user accounts, server-side persistence, or a backend service.
- Changing flooring rules, estimates, or existing edge-case behavior as part of a language migration.
- Claiming that generated layouts constitute professional installation advice.

## 3. Current architecture

### Runtime and deployment

- `src/main.ts` mounts the Vue application from `src/App.vue`.
- Vue 3 components provide the input forms, saved-layout controls, summary, and SVG visualization.
- `src/composables/useLaminateLayout.ts` owns reactive inputs and application actions. Vue computed values call the layout generator and summary calculator when their dependencies change.
- Vite builds the static frontend. The Docker image builds the app with Node and serves the generated files with Nginx; Nginx falls back to `index.html` for application routes.
- There is no application backend or remote data service in the current implementation.

### Layers and responsibilities

| Area | Current location | Responsibility |
| --- | --- | --- |
| UI and orchestration | `src/App.vue`, `src/components/`, `src/composables/useLaminateLayout.ts` | Bind user inputs to actions, display results, manage reactive state |
| Domain contracts | `src/lib/types.ts` | Define layout inputs, plank pieces, results, saved layouts, and summary data |
| Layout generation | `src/lib/laminateLayout.ts` | Validate usable dimensions, assign rows and starters, apply constraints, reuse offcuts, and produce warnings |
| Geometry | `src/lib/geometry.ts` | Rectangle overlap and containment checks with a small numeric tolerance |
| Randomness | `src/lib/rng.ts` | Produce a deterministic PRNG from a seed and choose a new seed on request |
| Summary | `src/lib/summary.ts` | Count generated pieces, estimate board consumption and purchasing, and calculate areas |
| Persistence | `src/lib/savedLayouts.ts` | Validate and store named input-and-seed snapshots in browser `localStorage` |
| Rendering | `src/components/LayoutSvg.vue` | Draw planks, room boundary, expansion-gap guide, and cutouts as SVG |

### Main data flow

1. The user changes reactive room, plank, constraint, cutout, or manual-row inputs, or requests a new random seed.
2. `useLaminateLayout` passes the current inputs and seed to `generateLayout`.
3. The generator returns plank rectangles, row count, the seed, and any warnings. `computeSummary` derives counts and area/purchase figures from this result and the inputs.
4. Vue passes the result to the summary panel and SVG view. The SVG uses a mask for the room and cutouts; pieces overlapping cutouts are marked in the result and visually masked.
5. Saving stores the inputs and seed in `localStorage`; loading restores both, so the same randomized layout can be regenerated.

## 4. Current functional behavior

- Dimensions are represented in centimeters; areas in the summary are shown in square meters.
- The effective layout area is reduced by the expansion gap on each side of both room axes.
- Plank direction can run along the room length or width.
- Rows are formed across the perpendicular room axis. The final row may be narrower; the generator can redistribute the two edge rows when needed to satisfy the configured minimum width.
- Automatic first cuts are seeded and attempt to respect both the minimum fragment length and the minimum joint offset relative to the previous row. The generator relaxes constraints with warnings or uses a deterministic fallback if sampling cannot find a candidate.
- Manual rows override only their first-cut length. Invalid or constraint-violating manual values are retained where possible and reported with warnings; manual rows beyond the room's row count are ignored with a warning.
- Usable leftovers can be reused as later row starters subject to length, width, offset, and placement constraints. A starter fully omitted by a cutout does not consume the matched offcut.
- A plank wholly inside a cutout is omitted. A plank that intersects a cutout is retained in the result with an obstacle-clipped flag; the SVG mask hides the cutout region visually.
- Summary estimates distinguish full and cut pieces, reused offcuts, board consumption, purchase quantity with waste margin, and floor/plank/coverage areas.
- Saved layouts are browser-local, sorted newest first, and upserted by trimmed name. Records contain inputs and seed; malformed stored records are ignored.

## 5. Domain boundary for the migration

The Go/WebAssembly engine should own calculation behavior, not browser or presentation behavior. Its conceptual input is the complete layout input model plus a seed. Its output is the layout result (plank rectangles and flags, row count, seed, warnings) and, subject to the interface decision below, summary values. The frontend should continue to own interactive state, form validation presentation, SVG rendering, and `localStorage`.

The existing TypeScript contracts in `src/lib/types.ts` are the initial reference for the boundary. The migration must specify a stable serialization format for numbers, orientation values, optional collections, result flags, and warnings. Browser storage should remain compatible with existing saved layouts unless a deliberate versioned migration is approved.

### Compatibility requirements

1. For equivalent normalized inputs and seeds, the Go engine must match the existing TypeScript engine's layout geometry, ordering, flags, row count, and warning conditions/messages where they are user-visible.
2. Repeated calculations with the same input and seed must produce the same result. Random-number behavior must be explicitly specified; Go's default random source must not silently replace the current seeded generator.
3. Preserve current units and formulas, including the expansion-gap treatment and purchase rounding, until product owners explicitly approve changes.
4. Preserve tolerance-sensitive behaviors and documented fallbacks for infeasible constraints, degenerate dimensions, short end cuts, manual rows, and offcut reuse.
5. Calculation failures or invalid payloads must be returned to the UI in a defined, recoverable form; they must not crash or silently produce stale results.
6. Keep browser storage and visualization operational when the calculation implementation is replaced.

## 6. WebAssembly product requirements

- The browser must load and initialize the Go WebAssembly module through the production Vite build, not only in a development environment.
- The frontend must pass the complete supported input and seed to the module and consume a typed result without depending on Go-specific memory representations.
- Module initialization and calculation errors must be visible or safely handled, with no blank or frozen application state.
- The UI must remain responsive for supported room sizes and input combinations. The team must decide whether synchronous calculations are sufficient or whether a worker is required.
- The WebAssembly artifact must be deployed as part of the static site and work under the existing Docker/Nginx deployment model.
- Existing browser saved layouts must continue to load and reproduce the same seeded results after the migration.
- The implementation must include a native Go test suite for calculation rules and cross-language parity coverage against representative TypeScript fixtures before the TypeScript implementation is removed.

## 7. Acceptance criteria

- All current user workflows remain available: editing inputs, adding/removing cutouts and manual rows, regenerating, saving/loading/deleting layouts, viewing the drawing, and reading the summary and warnings.
- A fixed corpus of inputs and seeds produces matching TypeScript and Go outputs, including edge cases, with numeric comparisons using an agreed tolerance.
- Existing unit scenarios for geometry bounds, gap handling, cutouts, orientation, manual cuts, constraints, deterministic seeds, and offcut reuse pass against the Go implementation.
- The production build serves and initializes the WASM module in the deployed static application.
- Existing `localStorage` records continue to load without loss or an undocumented reset.
- The application has a defined fallback/error experience when WebAssembly is unavailable or fails to initialize.

## 8. Risks and known behavior to preserve or review

- Floating-point calculations and iteration/order differences can produce small geometric or behavioral differences across languages; parity requires explicit tolerances and stable ordering.
- Reproducing the seeded output requires porting or intentionally versioning the current PRNG behavior.
- The current cutout-area summary subtracts the sum of cutout rectangle areas; overlapping or out-of-room cutouts are not union-clipped before this calculation. Changing that formula would change product behavior and should be treated as a separate decision.
- The board-consumption and coverage values are estimates based on generated pieces and reused offcuts, not a simulation of every physical board purchase or installation condition.
- WebAssembly startup, browser support, and calculation duration need to be measured with realistic and worst-case inputs.
- Saved-layout validation is implemented in the browser. If input/result serialization changes, schema compatibility needs an explicit versioning and migration strategy.

## 9. Decisions to resolve before implementation

1. Should the Wasm boundary return only `LayoutResult`, leaving `computeSummary` in TypeScript, or return both layout and summary from Go?
2. What exact wire format should be used, and should the boundary accept/return JSON strings or use a generated/typed bridge?
3. Must the Go engine reproduce the current PRNG and exact warnings, or is a versioned algorithm change acceptable?
4. Should generation run synchronously or in a Web Worker, and what input-size/latency target defines acceptable responsiveness?
5. What browsers and minimum Go/WebAssembly runtime versions are supported?
6. Should migration be staged with both implementations available for parity checks, and what criteria permit removing the TypeScript engine?
7. Should existing known estimate limitations be preserved for parity or separately corrected with explicit product approval?

## 10. Current verification baseline

The repository defines `npm run test` for the Vitest suite and `npm run build` for TypeScript checking and the Vite production build. Tests cover layout generation, summary calculations, and saved-layout persistence. These are the baseline checks to keep passing during the migration; Go-native tests and cross-language parity tests are additional migration deliverables.
