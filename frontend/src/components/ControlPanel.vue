<template>
  <section class="control-card">
    <div class="panel-header">
      <div>
        <p class="section-kicker">Control bench</p>
        <h2>Live Output</h2>
      </div>
      <div class="badge" :class="mode === 'AUTO' ? 'badge-auto' : 'badge-manual'">
        {{ mode }}
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric-box power">
        <div class="metric-label">Panel Power</div>
        <div class="value">{{ power.toFixed(1) }}</div>
        <div class="unit">W</div>
      </div>
      
      <div class="metric-box voltage">
        <div class="metric-label">Panel Voltage</div>
        <div class="value">{{ voltage.toFixed(1) }}</div>
        <div class="unit">V</div>
      </div>

      <div class="metric-box current">
        <div class="metric-label">Panel Current</div>
        <div class="value">{{ currentAmps.toFixed(2) }}</div> 
        <div class="unit">A</div>
      </div>

      <div class="metric-box load-power">
        <div class="metric-label">Load Power</div>
        <div class="value">{{ loadSensor ? loadPower.toFixed(1) : '--' }}</div>
        <div class="unit">W</div>
      </div>

      <div class="metric-box load-voltage">
        <div class="metric-label">Load Voltage</div>
        <div class="value">{{ loadSensor ? loadVoltage.toFixed(1) : '--' }}</div>
        <div class="unit">V</div>
      </div>

      <div class="metric-box load-current">
        <div class="metric-label">Load Current</div>
        <div class="value">{{ loadSensor ? loadCurrentAmps.toFixed(2) : '--' }}</div>
        <div class="unit">A</div>
      </div>
    </div>

    <div class="controls-section">
      <div class="mode-selector" role="group" aria-label="Operating mode">
        <button 
          :class="{ active: mode === 'MANUAL' }" 
          @click="$emit('update:mode', 'MANUAL')"
        >Manual</button>
        <button 
          :class="{ active: mode === 'AUTO' }" 
          @click="$emit('update:mode', 'AUTO')"
        >Auto MPPT</button>
      </div>

      <div v-if="mode === 'MANUAL'" class="manual-input">
        <div class="field-row">
          <label for="duty">Duty cycle</label>
          <output for="duty">{{ (duty * 100).toFixed(0) }}%</output>
        </div>
        <input 
          id="duty"
          type="range" 
          min="0" 
          max="0.95" 
          step="0.01" 
          :value="duty" 
          @input="$emit('update:duty', parseFloat($event.target.value))"
        />
      </div>

      <div v-if="mode === 'AUTO'" class="auto-input">
        <div class="algo-options">
          <label for="algorithm">Algorithm</label>
          <select id="algorithm" :value="algorithm" @change="$emit('update:algorithm', $event.target.value)">
            <option value="PNO">Perturb & Observe</option>
            <option value="INCCOND">Incremental Conductance</option>
          </select>
        </div>
        <button class="action-btn sweep" @click="$emit('trigger:sweep')">
          Start Sweep
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  mode: String,
  algorithm: String,
  duty: Number,
  power: Number,
  voltage: Number,
  current: Number,
  loadPower: Number,
  loadVoltage: Number,
  loadCurrent: Number,
  loadSensor: Boolean
})

const currentAmps = computed(() => props.current || 0);
const loadCurrentAmps = computed(() => props.loadCurrent || 0);

defineEmits(['update:mode', 'update:algorithm', 'update:duty', 'trigger:sweep'])
</script>

<style scoped>
.control-card {
  min-height: 100%;
  background: #ffffff;
  border-radius: 8px;
  padding: 18px;
  box-shadow: 0 14px 34px rgba(25, 39, 52, 0.08);
  color: #17212b;
  display: flex;
  flex-direction: column;
  gap: 18px;
  border: 1px solid #d8dfdd;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.section-kicker {
  margin: 0 0 4px;
  color: #2f7f66;
  font-size: 0.76rem;
  font-weight: 850;
  text-transform: uppercase;
}

.panel-header h2 {
  margin: 0;
  font-size: 1.35rem;
  color: #17212b;
  font-weight: 850;
}

.badge {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 850;
  text-transform: uppercase;
  white-space: nowrap;
}
.badge-auto { 
  background: #e4f4ec;
  color: #207652;
}
.badge-manual { 
  background: #fff0df;
  color: #9a5627;
}

.metrics-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.metric-box {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: baseline;
  gap: 10px;
  min-height: 74px;
  padding: 14px;
  border-radius: 6px;
  background: #f8faf8;
  border: 1px solid #dfe6e3;
}

.metric-box.power {
  border-left: 4px solid #d14b3f;
}
.metric-box.voltage {
  border-left: 4px solid #2f7fbe;
}
.metric-box.current {
  border-left: 4px solid #c8902f;
}
.metric-box.load-power {
  border-left: 4px solid #7a62b8;
}
.metric-box.load-voltage {
  border-left: 4px solid #4f8f9d;
}
.metric-box.load-current {
  border-left: 4px solid #8a9652;
}

.metric-label {
  color: #5e6875;
  font-size: 0.86rem;
  font-weight: 800;
}

.value {
  color: #17212b;
  font-size: 2rem;
  font-weight: 850;
  line-height: 1;
}

.unit {
  color: #687483;
  font-size: 0.9rem;
  font-weight: 800;
}

.controls-section {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.mode-selector {
  display: flex;
  background: #e8eeeb;
  padding: 4px;
  border-radius: 8px;
}

.mode-selector button {
  flex: 1;
  background: transparent;
  border: none;
  color: #65707f;
  min-height: 42px;
  padding: 8px 10px;
  border-radius: 6px;
  font-weight: 850;
  font-size: 0.92rem;
}

.mode-selector button:hover {
  color: #17212b;
}

.mode-selector button.active {
  background: white;
  color: #17212b;
  box-shadow: 0 4px 14px rgba(32, 39, 51, 0.09);
}

.manual-input,
.auto-input {
  padding: 14px;
  border: 1px solid #dfe6e3;
  border-radius: 8px;
  background: #f8faf8;
}

.field-row,
.algo-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  color: #4d5968;
  font-weight: 800;
}

.field-row {
  margin-bottom: 12px;
}

output {
  color: #17212b;
  font-weight: 850;
}

.manual-input input {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  -webkit-appearance: none;
  appearance: none;
  background: #dce5e1;
}

.manual-input input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2f7f66;
  border: 3px solid white;
  box-shadow: 0 2px 8px rgba(32, 39, 51, 0.24);
}

.auto-input {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.algo-options select {
  background: white;
  color: #202733;
  border: 1px solid #cfd9d5;
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: 750;
  min-width: 190px;
}

.action-btn.sweep {
  width: 100%;
  min-height: 44px;
  padding: 10px 14px;
  background: #17212b;
  border: 1px solid #17212b;
  border-radius: 6px;
  color: white;
  font-weight: 850;
  font-size: 0.95rem;
}
.action-btn.sweep:hover {
  background: #2f7f66;
  border-color: #2f7f66;
}

@media (max-width: 1180px) and (min-width: 861px) {
  .control-card {
    min-height: 100%;
  }
}

@media (max-width: 860px) {
  .control-card {
    min-height: auto;
  }

  .metrics-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .metric-box {
    grid-template-columns: 1fr;
    gap: 6px;
    min-height: 96px;
  }

  .value {
    font-size: clamp(1.45rem, 6vw, 1.9rem);
  }
}

@media (max-width: 620px) {
  .control-card {
    padding: 14px;
    gap: 14px;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .metric-box {
    grid-template-columns: 1fr auto auto;
    min-height: 64px;
    padding: 12px;
  }

  .panel-header h2 {
    font-size: 1.18rem;
  }

  .algo-options {
    align-items: stretch;
    flex-direction: column;
  }

  .algo-options select {
    min-width: 0;
    width: 100%;
  }
}
</style>
