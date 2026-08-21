<script setup lang="ts">
import { computed } from 'vue'
import type { CutoutInput, PlankPiece, RoomInput } from '../lib/types'

const props = defineProps<{
  room: RoomInput
  expansionGapCm: number
  cutouts: CutoutInput[]
  planks: PlankPiece[]
}>()

const viewBox = computed(() => `0 0 ${Math.max(props.room.width, 1)} ${Math.max(props.room.length, 1)}`)

// Stroke/font sizes are expressed in cm-equivalent units so they read sensibly
// across a wide range of room sizes once scaled by the SVG viewBox.
const strokeWidth = computed(() => Math.max(props.room.width, props.room.length) / 400)

const insetRect = computed(() => {
  const gap = Math.max(props.expansionGapCm, 0)
  if (gap <= 0) return null
  const width = props.room.width - 2 * gap
  const length = props.room.length - 2 * gap
  if (width <= 0 || length <= 0) return null
  return { x: gap, y: gap, width, height: length }
})
</script>

<template>
  <svg class="layout-svg" :viewBox="viewBox" preserveAspectRatio="xMidYMid meet">
    <defs>
      <mask id="room-mask">
        <rect :x="0" :y="0" :width="room.width" :height="room.length" fill="white" />
        <rect
          v-for="cutout in cutouts"
          :key="'mask-' + cutout.id"
          :x="cutout.x"
          :y="cutout.y"
          :width="cutout.width"
          :height="cutout.height"
          fill="black"
        />
      </mask>
      <pattern id="cutout-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="#d9534f" fill-opacity="0.15" />
        <line x1="0" y1="0" x2="0" y2="8" stroke="#d9534f" :stroke-width="strokeWidth * 2" />
      </pattern>
    </defs>

    <g mask="url(#room-mask)">
      <rect
        v-for="(plank, i) in planks"
        :key="plank.id"
        :x="plank.x"
        :y="plank.y"
        :width="plank.width"
        :height="plank.height"
        :class="['plank', plank.row % 2 === 0 ? 'plank-even' : 'plank-odd', { 'plank-cut': plank.isCut }]"
        :stroke-width="strokeWidth"
        vector-effect="non-scaling-stroke"
      >
        <title>Row {{ plank.row + 1 }} · plank {{ i + 1 }} · {{ plank.width.toFixed(1) }}cm x {{ plank.height.toFixed(1) }}cm{{ plank.isCut ? ' (cut)' : '' }}{{ plank.isClippedByObstacle ? ' — cut around obstacle' : '' }}</title>
      </rect>
    </g>

    <rect
      v-for="cutout in cutouts"
      :key="cutout.id"
      :x="cutout.x"
      :y="cutout.y"
      :width="cutout.width"
      :height="cutout.height"
      class="cutout"
      fill="url(#cutout-hatch)"
      :stroke-width="strokeWidth * 1.5"
    />

    <rect
      class="room-outline"
      :x="0"
      :y="0"
      :width="room.width"
      :height="room.length"
      fill="none"
      :stroke-width="strokeWidth * 2"
      vector-effect="non-scaling-stroke"
    />

    <rect
      v-if="insetRect"
      class="expansion-gap-guide"
      :x="insetRect.x"
      :y="insetRect.y"
      :width="insetRect.width"
      :height="insetRect.height"
      fill="none"
      :stroke-width="strokeWidth"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

<style scoped>
.layout-svg {
  width: 100%;
  height: 100%;
  background: #faf7f2;
}

.plank {
  stroke: #6b4b31;
}

.plank-even {
  fill: #dcb98a;
}

.plank-odd {
  fill: #cfa877;
}

.plank-cut {
  fill-opacity: 0.85;
}

.cutout {
  stroke: #d9534f;
  stroke-dasharray: 4 3;
}

.room-outline {
  stroke: #2b2019;
}

.expansion-gap-guide {
  stroke: #8a97a6;
  stroke-dasharray: 6 4;
}
</style>
