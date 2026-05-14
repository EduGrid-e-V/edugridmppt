<script setup>
import { ref, onMounted, watch, computed } from 'vue';

const props = defineProps({
  dataBuffer: [Array, Float32Array], // Expects a flat array of floats [v1, v2, v3...]
  sampleRate: { type: Number, default: 10000 }, // e.g., 10kHz
  width: { type: Number, default: 600 },
  height: { type: Number, default: 300 }
});

const canvasRef = ref(null);
const isPaused = ref(false);

// Controls
const timeDiv = ref(5); // Milliseconds per grid division
const voltsDiv = ref(1); // Volts per grid division
const triggerLevel = ref(1.5); // Voltage trigger threshold
const triggerMode = ref('rising'); // 'rising' or 'falling' or 'none'

// Grid Settings
const GRID_X_DIVS = 10;
const GRID_Y_DIVS = 8;

const draw = () => {
  if (isPaused.value) return; // Don't redraw if paused (freeze frame)
  
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = props.width;
  const h = props.height;

  // 1. Clear Screen
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  // 2. Draw Grid
  drawGrid(ctx, w, h);

  // 3. Find Trigger Point (Stabilize the Wave)
  let startIndex = 0;
  if (triggerMode.value !== 'none') {
    startIndex = findTriggerIndex(props.dataBuffer, triggerLevel.value, triggerMode.value);
    if (startIndex === -1) startIndex = 0; // Trigger not found, just draw
  }

  // 4. Draw Waveform
  ctx.beginPath();
  ctx.strokeStyle = "#00ff00"; // Classic Scope Green
  ctx.lineWidth = 2;

  // Calculate scaling
  const timePerPixel = (timeDiv.value * GRID_X_DIVS) / w; // ms per pixel
  const sampleTime = 1000 / props.sampleRate; // ms per sample
  const samplesPerPixel = timePerPixel / sampleTime;
  
  // Center 0V vertically
  const zeroY = h / 2;
  const pixelsPerVolt = (h / GRID_Y_DIVS) / voltsDiv.value;

  let x = 0;
  let bufferIdx = startIndex;

  ctx.moveTo(0, zeroY - (props.dataBuffer[bufferIdx] * pixelsPerVolt));

  while (x < w && bufferIdx < props.dataBuffer.length) {
    const val = props.dataBuffer[Math.floor(bufferIdx)];
    const y = zeroY - (val * pixelsPerVolt); // Invert Y
    
    ctx.lineTo(x, y);
    
    x += 1; // Move 1 pixel right
    bufferIdx += samplesPerPixel;
  }
  ctx.stroke();
};

const drawGrid = (ctx, w, h) => {
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.beginPath();

  // Vertical Lines
  const xStep = w / GRID_X_DIVS;
  for (let i = 1; i < GRID_X_DIVS; i++) {
    ctx.moveTo(i * xStep, 0);
    ctx.lineTo(i * xStep, h);
  }

  // Horizontal Lines
  const yStep = h / GRID_Y_DIVS;
  for (let i = 1; i < GRID_Y_DIVS; i++) {
    ctx.moveTo(0, i * yStep);
    ctx.lineTo(w, i * yStep);
  }
  ctx.stroke();

  // Draw Center Crosshair
  ctx.strokeStyle = "#666";
  ctx.beginPath();
  ctx.moveTo(w/2, 0); ctx.lineTo(w/2, h);
  ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
  ctx.stroke();
};

const findTriggerIndex = (buffer, level, mode) => {
  // Simple trigger search
  for (let i = 1; i < buffer.length - 100; i++) {
    const prev = buffer[i-1];
    const curr = buffer[i];
    
    if (mode === 'rising') {
      if (prev < level && curr >= level) return i;
    } else if (mode === 'falling') {
      if (prev > level && curr <= level) return i;
    }
  }
  return -1; // Not found
};

// Redraw whenever data comes in (or roughly 60fps loop)
watch(() => props.dataBuffer, () => {
    requestAnimationFrame(draw);
});

onMounted(() => {
    draw();
});
</script>

<template>
  <div class="scope-wrapper">
    <div class="screen">
        <canvas ref="canvasRef" :width="width" :height="height"></canvas>
        <div class="overlay-info">
            {{ timeDiv }}ms/div | {{ voltsDiv }}V/div
        </div>
    </div>
    
    <div class="controls">
        <div class="control-group">
            <label>Time/Div</label>
            <input type="range" min="1" max="50" step="1" v-model.number="timeDiv">
            <span>{{ timeDiv }}ms</span>
        </div>
        
        <div class="control-group">
            <label>Volts/Div</label>
            <input type="range" min="0.1" max="5" step="0.1" v-model.number="voltsDiv">
            <span>{{ voltsDiv }}V</span>
        </div>

        <div class="control-group">
            <label>Trigger</label>
            <input type="range" min="-5" max="5" step="0.1" v-model.number="triggerLevel">
            <span>{{ triggerLevel }}V</span>
        </div>

        <button @click="isPaused = !isPaused" :class="{ paused: isPaused }">
            {{ isPaused ? 'RUN' : 'STOP' }}
        </button>
    </div>
  </div>
</template>

<style scoped>
.scope-wrapper {
  background: #222;
  padding: 10px;
  border-radius: 8px;
  display: inline-block;
  color: #ddd;
  font-family: monospace;
}

.screen {
    position: relative;
    border: 4px solid #444;
    border-radius: 4px;
    background: #000;
}

.overlay-info {
    position: absolute;
    top: 5px;
    left: 10px;
    color: #00ff00;
    pointer-events: none;
    font-weight: bold;
}

.controls {
    margin-top: 10px;
    display: flex;
    gap: 15px;
    align-items: center;
    font-size: 0.8rem;
}

.control-group {
    display: flex;
    flex-direction: column;
}

input[type=range] {
    width: 100px;
}

button {
    background: #4caf50;
    border: none;
    padding: 8px 16px;
    color: white;
    font-weight: bold;
    cursor: pointer;
    border-radius: 4px;
}

button.paused {
    background: #f44336;
    animation: blink 1s infinite;
}

@keyframes blink {
    50% { opacity: 0.5; }
}
</style>