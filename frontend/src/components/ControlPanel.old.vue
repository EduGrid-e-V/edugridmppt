<template>
  <div class="control-panel">
    <div class="metrics">
      <div class="metric">
        <span class="value">{{ power.toFixed(1) }}</span>
        <span class="unit">W</span>
      </div>
      <div class="metric">
        <span class="value">{{ voltage.toFixed(1) }}</span>
        <span class="unit">V</span>
      </div>
    </div>

    <div class="controls">
      <div class="mode-toggle">
        <label>Mode:</label>
        <button 
          :class="{ active: mode === 'AUTO' }" 
          @click="$emit('update:mode', 'AUTO')"
        >AUTO</button>
        <button 
          :class="{ active: mode === 'MANUAL' }" 
          @click="$emit('update:mode', 'MANUAL')"
        >MANUAL</button>
      </div>

      <div v-if="mode === 'MANUAL'" class="manual-controls">
        <label>Duty Cycle: {{ (duty * 100).toFixed(0) }}%</label>
        <input 
          type="range" 
          min="0" 
          max="0.95" 
          step="0.01" 
          :value="duty" 
          @input="$emit('update:duty', parseFloat($event.target.value))"
        />
      </div>

      <div v-if="mode === 'AUTO'" class="auto-controls">
        <div class="algo-toggle">
          <label>Algorithm:</label>
          <button 
            :class="{ active: algorithm === 'PNO' }"
            @click="$emit('update:algorithm', 'PNO')"
          >P&O</button>
          <button 
            :class="{ active: algorithm === 'INCCOND' }"
            @click="$emit('update:algorithm', 'INCCOND')"
          >IncCond</button>
        </div>
        <button class="sweep-btn" @click="$emit('trigger:sweep')">START SWEEP</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  mode: {
    type: String,
    required: true
  },
  algorithm: {
    type: String,
    required: true
  },
  duty: {
    type: Number,
    required: true
  },
  power: {
    type: Number,
    required: true
  },
  voltage: {
    type: Number,
    required: true
  }
})

defineEmits(['update:mode', 'update:algorithm', 'update:duty', 'trigger:sweep'])
</script>

<style scoped>
.control-panel {
  padding: 1rem;
  background: #2a2a2a; /* Dark background */
  color: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.metrics {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.metric .value {
  display: block;
  font-size: 2.5rem;
  font-weight: bold;
}

.metric .unit {
  font-size: 1rem;
  color: #aaa;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mode-toggle, .algo-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

button {
  background: #444;
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  flex: 1;
}

button.active {
  background: #42b983; /* Vue Green */
  font-weight: bold;
}

.manual-controls {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

input[type="range"] {
  width: 100%;
}

.sweep-btn {
  background: #3498db;
  margin-top: 0.5rem;
  font-weight: bold;
  width: 100%;
}
</style>
