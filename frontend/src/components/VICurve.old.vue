<template>
  <div class="vi-curve-container">
    <canvas ref="canvasRef" :width="width" :height="height"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';

const props = defineProps({
  voltage: { type: Number, required: true },
  current: { type: Number, required: true },
  sweepData: { type: Array, default: () => [] },
  width: { type: Number, default: 500 },
  height: { type: Number, default: 350 }
});

const canvasRef = ref(null);
const history = ref([]); // Ring buffer for trail
const MAX_HISTORY = 20;

// Margins for axes
const padding = { top: 20, right: 20, bottom: 30, left: 40 };

// Safe defaults if no sweep data
const maxX = ref(25); 
const maxY = ref(5);

// Watch for sweep data to auto-scale
watch(() => props.sweepData, (newData) => {
  if (newData && newData.length > 0) {
    const vMax = Math.max(...newData.map(p => p.v));
    const iMax = Math.max(...newData.map(p => p.i));
    maxX.value = vMax * 1.1 || 25; // add 10% padding
    maxY.value = iMax * 1.1 || 5;
  }
}, { immediate: true });

// Ring buffer logic
watch(
  [() => props.voltage, () => props.current],
  ([v, i]) => {
    history.value.push({ v, i });
    if (history.value.length > MAX_HISTORY) {
      history.value.shift();
    }
    draw();
  }
);

const draw = () => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Helper to map values to canvas coordinates
  const graphWidth = canvas.width - padding.left - padding.right;
  const graphHeight = canvas.height - padding.top - padding.bottom;
  
  const toX = (v) => padding.left + (v / maxX.value) * graphWidth;
  const toY = (i) => canvas.height - padding.bottom - (i / maxY.value) * graphHeight;

  // Draw Axes
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Y Axis
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, canvas.height - padding.bottom);
  // X Axis
  ctx.moveTo(padding.left, canvas.height - padding.bottom);
  ctx.lineTo(canvas.width - padding.right, canvas.height - padding.bottom);
  ctx.stroke();

  // Draw Sweep Data (Static dashed line)
  if (props.sweepData && props.sweepData.length > 0) {
    ctx.strokeStyle = '#aaa'; // Grey
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (const p of props.sweepData) {
      const x = toX(p.v);
      const y = toY(p.i);
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash
  }

  // Draw History Trail
  if (history.value.length > 1) {
    // We want fading. Can't do single path easily with gradient unless continuous.
    // Instead draw segments with varying opacity.
    ctx.lineWidth = 2;
    for (let j = 0; j < history.value.length - 1; j++) {
      const p1 = history.value[j];
      const p2 = history.value[j+1];
      const opacity = (j + 1) / history.value.length; // fade in
      ctx.strokeStyle = `rgba(0, 255, 0, ${opacity})`;
      ctx.beginPath();
      ctx.moveTo(toX(p1.v), toY(p1.i));
      ctx.lineTo(toX(p2.v), toY(p2.i));
      ctx.stroke();
    }
  }

  // Draw Live Point
  const cx = toX(props.voltage);
  const cy = toY(props.current);
  
  ctx.fillStyle = '#0f0'; // Bright Green
  ctx.shadowBlur = 10;
  ctx.shadowColor = '#0f0';
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.shadowBlur = 0;
};

onMounted(() => {
  draw();
});
</script>

<style scoped>
.vi-curve-container {
  background: #222;
  border-radius: 8px;
  display: inline-block;
  overflow: hidden;
}
canvas {
  display: block; /* remove bottom whitespace */
}
</style>
