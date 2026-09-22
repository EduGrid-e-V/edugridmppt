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

    <div class="measurement-groups" aria-label="Live measurements">
      <section class="measurement-card panel-measurements" aria-labelledby="panel-measurements">
        <div class="measurement-card-title">
          <h3 id="panel-measurements">Panel</h3>
          <span>PV input</span>
        </div>
        <p class="preset-provenance"><strong>{{ presetLabel }}</strong> · {{ presetSource }}</p>
        <dl class="reading-list">
          <div
            v-for="reading in panelReadings"
            :key="reading.key"
            class="reading-row"
            :class="reading.key"
            :title="reading.description"
            :aria-label="`${reading.label}: ${reading.description}`"
          >
            <dt>{{ reading.label }}</dt>
            <dd>
              <span>{{ reading.value }}</span>
              <small>{{ reading.unit }}</small>
            </dd>
          </div>
        </dl>
      </section>

      <section class="measurement-card load-measurements" aria-labelledby="load-measurements">
        <div class="measurement-card-title">
          <h3 id="load-measurements">Load</h3>
          <span>Converter output</span>
        </div>
        <dl class="reading-list">
          <div
            v-for="reading in loadReadings"
            :key="reading.key"
            class="reading-row"
            :class="reading.key"
            :title="reading.description"
            :aria-label="`${reading.label}: ${reading.description}`"
          >
            <dt>{{ reading.label }}</dt>
            <dd>
              <span>{{ reading.value }}</span>
              <small>{{ reading.unit }}</small>
            </dd>
          </div>
        </dl>
      </section>
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

      <div v-if="mode === 'MANUAL'" class="manual-input" :title="dutyCycleDescription">
        <div class="field-row">
          <label for="duty" :title="dutyCycleDescription">Duty cycle</label>
          <output for="duty" :title="dutyCycleDescription">{{ (duty * 100).toFixed(0) }}%</output>
        </div>
        <input 
          id="duty"
          type="range" 
          min="0" 
          max="0.95" 
          step="0.01" 
          :value="duty" 
          :title="dutyCycleDescription"
          :aria-label="dutyCycleDescription"
          @input="$emit('update:duty', parseFloat($event.target.value))"
        />
      </div>

      <div v-if="mode === 'AUTO'" class="auto-input">
        <div class="algo-options">
          <label for="algorithm">Algorithm</label>
          <select id="algorithm" :value="algorithm" @change="$emit('update:algorithm', $event.target.value)">
            <option v-for="option in algorithmOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
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
  loadSensor: Boolean,
  presetLabel: String,
  presetSource: String,
  algorithmOptions: {
    type: Array,
    default: () => [
      { id: 'PNO', label: 'Perturb & Observe' },
      { id: 'INCCOND', label: 'Incremental Conductance' }
    ]
  }
})

defineEmits(['update:mode', 'update:algorithm', 'update:duty', 'trigger:sweep'])

const panelReadings = computed(() => [
  {
    key: 'power',
    label: 'Power',
    value: formatMeasurement(props.power),
    unit: 'W',
    description: 'Electrical power currently produced by the PV panel input.'
  },
  {
    key: 'voltage',
    label: 'Voltage',
    value: formatMeasurement(props.voltage),
    unit: 'V',
    description: 'Voltage measured at the PV panel side of the converter.'
  },
  {
    key: 'current',
    label: 'Current',
    value: formatMeasurement(props.current),
    unit: 'A',
    description: 'Current flowing from the PV panel into the converter.'
  }
]);

const loadReadings = computed(() => [
  {
    key: 'load-power',
    label: 'Power',
    value: formatLoadMeasurement(props.loadPower),
    unit: 'W',
    description: 'Electrical power delivered to the load at the converter output.'
  },
  {
    key: 'load-voltage',
    label: 'Voltage',
    value: formatLoadMeasurement(props.loadVoltage),
    unit: 'V',
    description: 'Voltage measured at the load or output side of the converter.'
  },
  {
    key: 'load-current',
    label: 'Current',
    value: formatLoadMeasurement(props.loadCurrent),
    unit: 'A',
    description: 'Current flowing into the load from the converter output.'
  }
]);

const dutyCycleDescription = 'Duty cycle is the fraction of each PWM period where the converter switch is on. Changing it changes the electrical load seen by the panel.';

const formatMeasurement = (measurementValue) => {
  const numericMeasurement = Number(measurementValue);
  return Number.isFinite(numericMeasurement) ? numericMeasurement.toFixed(2) : '--';
};

const formatLoadMeasurement = (measurementValue) => {
  return props.loadSensor ? formatMeasurement(measurementValue) : '--';
};
</script>

<style scoped>
.control-card {
  min-height: 100%;
  background: #ffffff;
  border-radius: 8px;
  padding: 14px;
  box-shadow: 0 14px 34px rgba(25, 39, 52, 0.08);
  color: #17212b;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  font-size: 1.2rem;
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

.measurement-groups {
  display: grid;
  gap: 8px;
}

.measurement-card {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 6px;
  background: #f8faf8;
  border: 1px solid #dfe6e3;
}

.panel-measurements {
  border-left: 4px solid #d14b3f;
}

.load-measurements {
  border-left: 4px solid #7a62b8;
}

.measurement-card-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.measurement-card-title h3 {
  margin: 0;
  color: #17212b;
  font-size: 0.95rem;
  font-weight: 850;
}

.measurement-card-title span {
  color: #687483;
  font-size: 0.76rem;
  font-weight: 800;
  text-transform: uppercase;
}

.preset-provenance {
  margin: 0;
  color: #687483;
  font-size: 0.72rem;
  line-height: 1.35;
}

.reading-list {
  display: grid;
  gap: 0;
  margin: 0;
}

.reading-row {
  display: grid;
  grid-template-columns: minmax(72px, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 32px;
  padding: 5px 0;
  border-top: 1px solid #e5ece9;
  cursor: help;
}

.reading-row:first-child {
  border-top: 0;
}

.reading-row:hover dt,
.reading-row:hover dd span {
  color: #2f7f66;
}

.reading-row dt {
  color: #5e6875;
  font-size: 0.86rem;
  font-weight: 800;
}

.reading-row dd {
  display: flex;
  justify-content: flex-end;
  align-items: baseline;
  gap: 7px;
  margin: 0;
}

.reading-row dd span {
  color: #17212b;
  font-size: 1.18rem;
  font-weight: 850;
  line-height: 1;
}

.reading-row dd small {
  color: #687483;
  font-size: 0.82rem;
  font-weight: 800;
}

.controls-section {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  min-height: 38px;
  padding: 7px 10px;
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
  padding: 12px;
  border: 1px solid #dfe6e3;
  border-radius: 8px;
  background: #f8faf8;
}

.manual-input {
  cursor: help;
}

.manual-input input {
  cursor: pointer;
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
  min-height: 40px;
  padding: 8px 12px;
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
    min-height: auto;
    display: grid;
    grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.25fr) minmax(280px, 0.95fr);
    align-items: start;
  }

  .measurement-groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .controls-section {
    margin-top: 0;
  }
}

@media (max-width: 860px) {
  .control-card {
    min-height: auto;
  }

  .measurement-groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .reading-row {
    grid-template-columns: 1fr;
    gap: 3px;
  }

  .reading-row dd {
    justify-content: flex-start;
  }
}

@media (max-width: 620px) {
  .control-card {
    padding: 14px;
    gap: 14px;
  }

  .measurement-groups {
    grid-template-columns: 1fr;
  }

  .measurement-card {
    padding: 12px;
  }

  .reading-row {
    grid-template-columns: minmax(72px, 1fr) auto;
  }

  .reading-row dd {
    justify-content: flex-end;
  }

  .reading-row dd span {
    font-size: 1.2rem;
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
