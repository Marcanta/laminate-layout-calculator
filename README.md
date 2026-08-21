# Laminate Layout Generator

Vue 3 + TypeScript app that generates a randomized "pose à joints perdus" (staggered, no-aligned-seams) laminate flooring layout for a rectangular room, with optional rectangular cutouts (islands, chimneys, etc.).

## Run

```
npm install
npm run dev
```

## Test

```
npm run test
```

## Build

```
npm run build
```

## Usage

Enter room and plank dimensions (cm), an expansion gap to leave between the planks and the walls (for thermal expansion), an optional minimum joint offset and purchase waste margin, and add any cutout zones to exclude. The diagram updates live; use "Re-randomize layout" to generate a new valid staggered pattern with the same inputs.
