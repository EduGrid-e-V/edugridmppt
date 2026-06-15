<template>
  <section class="simulation-panel" aria-label="PV simulation controls">
    <div class="scene-wrap">
      <svg class="scene-svg" viewBox="0 0 760 320" role="img" aria-label="Rooftop solar simulation">
        <rect class="sky" x="0" y="0" width="760" height="320" rx="8" />
        <path class="sun-track" d="M -10 336 A 390 270 0 0 1 770 336" />
        <g class="sun" :transform="`translate(${sunCoordinates.x} ${sunCoordinates.y})`">
          <circle class="sun-halo" r="48" />
          <circle class="sun-core" r="28" />
        </g>

        <g class="cloud-layer" :style="{ opacity: cloudVisualOpacity }">
          <g :transform="`translate(${cloudOffset} 0)`">
            <g class="cloud main-cloud">
              <ellipse cx="420" cy="102" rx="84" ry="30" />
              <circle cx="356" cy="96" r="28" />
              <circle cx="397" cy="78" r="38" />
              <circle cx="444" cy="82" r="34" />
              <circle cx="492" cy="100" r="25" />
              <rect x="348" y="98" width="150" height="32" rx="16" />
            </g>
            <g class="cloud secondary-cloud">
              <ellipse cx="218" cy="122" rx="58" ry="20" />
              <circle cx="178" cy="118" r="20" />
              <circle cx="209" cy="104" r="27" />
              <circle cx="244" cy="113" r="22" />
              <rect x="176" y="118" width="82" height="24" rx="12" />
            </g>
            <g class="cloud distant-cloud">
              <ellipse cx="568" cy="68" rx="46" ry="16" />
              <circle cx="540" cy="65" r="17" />
              <circle cx="568" cy="56" r="22" />
              <circle cx="596" cy="66" r="16" />
              <rect x="536" y="66" width="64" height="18" rx="9" />
            </g>
          </g>
        </g>

        <g class="house">
          <rect class="wall" x="156" y="198" width="448" height="92" rx="2" />
          <rect class="door" x="222" y="238" width="42" height="52" rx="2" />
          <rect class="window" x="316" y="226" width="58" height="34" rx="2" />
          <rect class="window" x="444" y="226" width="58" height="34" rx="2" />
          <path class="roof-eave" d="M116 214h528L566 118H194Z" />
          <path class="roof-face" d="M146 204h468L548 130H212Z" />
          <path class="roof-ridge" d="M212 130h336" />

          <g class="panel-array">
            <g v-for="panel in panels" :key="`${panel.x}-${panel.y}`" class="panel-module">
              <rect class="panel" :x="panel.x" :y="panel.y" :width="panel.width" :height="panel.height" />
              <path
                class="panel-cells"
                :d="cellPath(panel)"
              />
            </g>
          </g>
        </g>

        <rect class="ground" x="0" y="290" width="760" height="30" />
      </svg>
    </div>

    <div class="simulation-controls">
      <label class="sim-control">
        <span>Sun position</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="sunPosition"
          @input="$emit('update:sunPosition', Number($event.target.value))"
        />
      </label>

      <label class="sim-control">
        <span>Cloud cover</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="cloudCover"
          @input="$emit('update:cloudCover', Number($event.target.value))"
        />
      </label>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  sunPosition: { type: Number, required: true },
  cloudCover: { type: Number, required: true }
});

defineEmits(['update:sunPosition', 'update:cloudCover']);

const panels = [
  { x: 238, y: 142, width: 36, height: 54 },
  { x: 284, y: 142, width: 36, height: 54 },
  { x: 330, y: 142, width: 36, height: 54 },
  { x: 376, y: 142, width: 36, height: 54 },
  { x: 422, y: 142, width: 36, height: 54 },
  { x: 468, y: 142, width: 36, height: 54 }
];

const sunCoordinates = computed(() => {
  const angle = Math.PI * (1 - props.sunPosition);
  const centerX = 380;
  const baseY = 336;
  const radiusX = 390;
  const radiusY = 270;

  return {
    x: centerX + Math.cos(angle) * radiusX,
    y: baseY - Math.sin(angle) * radiusY
  };
});

const cloudVisualOpacity = computed(() => 0.1 + props.cloudCover * 0.9);
const cloudOffset = computed(() => -70 + props.cloudCover * 120);

function cellPath(panel) {
  const lines = [];
  const columns = 3;
  const rows = 6;

  for (let column = 1; column < columns; column += 1) {
    const x = panel.x + (panel.width / columns) * column;
    lines.push(`M ${x} ${panel.y + 3} V ${panel.y + panel.height - 3}`);
  }

  for (let row = 1; row < rows; row += 1) {
    const y = panel.y + (panel.height / rows) * row;
    lines.push(`M ${panel.x + 3} ${y} H ${panel.x + panel.width - 3}`);
  }

  return lines.join(' ');
}
</script>

<style scoped>
.simulation-panel {
  width: min(1760px, 100%);
  margin: 14px auto 0;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 14px;
  padding: 14px;
  border: 1px solid #d8dfdd;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 12px 34px rgba(25, 39, 52, 0.07);
}

.scene-wrap {
  border: 1px solid #dfe6e3;
  border-radius: 8px;
  background: #f8faf8;
  overflow: hidden;
}

.scene-svg {
  display: block;
  width: 100%;
  height: auto;
}

.sky {
  fill: #dceef6;
}

.ground {
  fill: #cbd8cf;
}

.sun-track {
  fill: none;
  stroke: rgba(161, 80, 67, 0.32);
  stroke-width: 3;
  stroke-dasharray: 8 8;
}

.sun-halo {
  fill: rgba(239, 181, 74, 0.2);
}

.sun-core {
  fill: #efb54a;
}

.cloud {
  fill: rgba(255, 255, 255, 0.88);
  stroke: rgba(122, 139, 151, 0.18);
  stroke-width: 1.6;
  filter: drop-shadow(0 5px 8px rgba(96, 112, 124, 0.12));
}

.secondary-cloud {
  opacity: 0.78;
}

.distant-cloud {
  opacity: 0.58;
}

.roof-eave {
  fill: #3f4853;
}

.roof-face {
  fill: #56616e;
}

.roof-ridge {
  fill: none;
  stroke: rgba(255, 255, 255, 0.34);
  stroke-width: 3;
}

.wall {
  fill: #d9ded2;
  stroke: rgba(23, 33, 43, 0.12);
  stroke-width: 2;
}

.door {
  fill: #7d6c5b;
}

.window {
  fill: #b7d4df;
  stroke: rgba(23, 33, 43, 0.16);
  stroke-width: 2;
}

.panel {
  fill: #183b59;
  stroke: #eef7fb;
  stroke-width: 2;
}

.panel-array {
  filter: drop-shadow(0 3px 3px rgba(23, 33, 43, 0.18));
}

.panel-cells {
  fill: none;
  stroke: rgba(238, 247, 251, 0.54);
  stroke-width: 1.2;
}

.simulation-controls {
  display: grid;
  align-content: center;
  gap: 16px;
}

.sim-control {
  display: grid;
  gap: 10px;
  color: #4d5968;
  font-size: 0.9rem;
  font-weight: 850;
}

.sim-control input {
  width: 100%;
  accent-color: #2f7f66;
}

@media (max-width: 860px) {
  .simulation-panel {
    grid-template-columns: 1fr;
  }
}
</style>
