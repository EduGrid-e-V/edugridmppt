<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-lockup" aria-label="EduGrid MPPT Dashboard">
        <svg class="brand-mark" viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="36" r="27" />
          <path d="M40 8v14M13 36H3M77 36H67M21 16l-8-8M59 16l8-8M20 56l-8 8M60 56l8 8" />
          <path d="M40 36v28M40 36l-23 13M40 36l23 13" />
          <path d="M25 55h30l6 17H19l6-17Z" />
          <path d="M29 55l-3 17M40 55v17M51 55l3 17M22 64h36" />
          <circle cx="40" cy="36" r="3" />
        </svg>
        <div>
          <div class="brand-title">EduGrid</div>
          <div class="brand-subtitle">MPPT Lab Dashboard</div>
        </div>
      </div>

      <div class="topbar-actions">
        <div class="source-switch" role="group" aria-label="Data source">
          <button
            :class="{ active: experimentSource === 'real' }"
            @click="setExperimentSource('real')"
          >
            Real
          </button>
          <button
            :class="{ active: experimentSource === 'simulation' }"
            @click="setExperimentSource('simulation')"
          >
            Sim
          </button>
        </div>
        <div class="connection-pill" :class="{ online: isConnected }">
          <span class="status-dot"></span>
          {{ connectionLabel }}
        </div>
      </div>
    </header>

    <section class="intro-band" aria-label="Experiment overview">
      <div class="intro-copy-block">
        <p class="eyebrow">Solar power electronics trainer</p>
        <h1>MPPT lab: observe, sweep, improve.</h1>
        <p class="intro-copy">
          Compare panel input and load output while the converter searches for the point where a PV
          module can deliver the most useful power.
        </p>
      </div>
      <div class="intro-side">
        <div class="source-summary">
          <span>Current workspace</span>
          <strong>{{ experimentSource === 'simulation' ? 'Simulation model' : 'Real ESP32 board' }}</strong>
          <p>
            {{ experimentSource === 'simulation'
              ? 'Use sunlight and cloud cover to see why the maximum power point moves.'
              : 'Watch live measurements from the board and test your control algorithm.' }}
          </p>
          <label class="preset-picker" for="panel-preset">
            Comparison panel
            <select id="panel-preset" :value="selectedPresetId" @change="setPreset($event.target.value)">
              <option v-for="preset in presets" :key="preset.id" :value="preset.id">
                {{ presetLabel(preset) }}
              </option>
            </select>
          </label>
        </div>
        <div class="learning-points" aria-label="Learning goals">
          <span>Measure V, I, P</span>
          <span>Compare algorithms</span>
          <span>Trace the I–V curve</span>
        </div>
      </div>
    </section>

    <section v-if="showPresetMismatch" class="preset-warning" role="alert">
      <div>
        <strong>The simulated panel is much larger than the one on your desk.</strong>
        <span>Selected: {{ selectedPresetLabel }}; live panel: {{ power.toFixed(2) }} W.</span>
      </div>
      <button @click="setPreset('edugrid-kit')">Switch to EduGrid kit</button>
    </section>

    <section v-if="experimentSource === 'simulation'" class="advanced-row">
      <button class="advanced-toggle" @click="toggleAdvancedSimulation">
        {{ showAdvancedSimulation ? 'Hide advanced simulation' : 'Advanced simulation' }}
      </button>
    </section>

    <SimulationScene
      v-if="experimentSource === 'simulation' && showAdvancedSimulation"
      :sunPosition="simulationSunPosition"
      :cloudCover="simulationCloudCover"
      @update:sunPosition="setSimulationSunPosition"
      @update:cloudCover="setSimulationCloudCover"
    />

    <section class="dashboard-grid" aria-label="MPPT controls and graphs">
      <ControlPanel
        class="controls-panel"
        :mode="mode"
        :algorithm="algorithm"
        :duty="duty"
        :power="power"
        :voltage="voltage"
        :current="current"
        :loadPower="loadPower"
        :loadVoltage="loadVoltage"
        :loadCurrent="loadCurrent"
        :loadSensor="loadSensor"
        :presetLabel="selectedPresetLabel"
        :presetSource="selectedPreset.source"
        @update:mode="setMode"
        @update:algorithm="setAlgorithm"
        @update:duty="setDuty"
        @trigger:sweep="doSweep"
      />

      <VICurve
        :key="`vi-${experimentSource}`"
        class="vi-panel"
        :voltage="voltage"
        :current="current"
        :sweepData="visibleCurveData"
      />

      <RealtimeChart
        class="power-panel"
        title="Power Over Time"
        color="#d14b3f"
        :max="powerChartAxisMaximum"
        :data="powerChartData"
      />
    </section>
  </main>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue';
import ControlPanel from './components/ControlPanel.vue';
import VICurve from './components/VICurve.vue';
import RealtimeChart from './components/RealtimeChart.vue';
import SimulationScene from './components/SimulationScene.vue';
import { createSensorConnection } from './services';
import { presets } from '@edugrid/pv-sim';

const isConnected = ref(false);

const voltage = ref(0);
const current = ref(0);
const power = ref(0);
const loadVoltage = ref(0);
const loadCurrent = ref(0);
const loadPower = ref(0);
const loadSensor = ref(false);
const duty = ref(0);
const mode = ref('MANUAL');
const algorithm = ref('PNO');
const experimentSource = ref(import.meta.env.DEV ? 'simulation' : 'real');
const showAdvancedSimulation = ref(false);
const simulationSunPosition = ref(0.55);
const simulationCloudCover = ref(0.12);
const selectedPresetId = ref('edugrid-kit');

const sweepCurveData = ref([]);
const sweepHasRun = ref(false);
const powerChartData = ref([[], []]);
const MAX_CHART_POINTS = 600;
const MANUAL_DUTY_ECHO_GRACE_MS = 1500;
let chartStartTime = null;
let sweepFallbackTimer = null;
let simulationCurveRefreshTimer = null;
let lastManualDutySetAt = 0;

let connector = null;

const connectionLabel = computed(() => {
  if (experimentSource.value === 'simulation') return 'Simulation';
  return isConnected.value ? 'Connected' : 'Real experiment offline';
});

const selectedPreset = computed(() => (
  presets.find((preset) => preset.id === selectedPresetId.value) || presets[0]
));
const selectedPresetLabel = computed(() => presetLabel(selectedPreset.value));
const selectedPresetPmpp = computed(() => selectedPreset.value.vmpp * selectedPreset.value.impp);
const showPresetMismatch = computed(() => {
  if (experimentSource.value !== 'real' || power.value <= 0) return false;
  const ratio = selectedPresetPmpp.value / power.value;
  return ratio > 5 || ratio < 0.2;
});

const presetLabel = (preset) => {
  if (preset.id === 'edugrid-kit') return 'EduGrid kit (1.71 W)';
  if (preset.id === 'roof-module-450w') return 'Real installation (not your kit)';
  return preset.id;
};

const visibleCurveData = computed(() => {
  if (experimentSource.value === 'simulation' && showAdvancedSimulation.value) {
    return sweepCurveData.value;
  }

  return sweepHasRun.value ? sweepCurveData.value : [];
});

const powerChartAxisMaximum = computed(() => (
  experimentSource.value === 'real' ? 2 : undefined
));

const resetDashboardData = () => {
  voltage.value = 0;
  current.value = 0;
  power.value = 0;
  loadVoltage.value = 0;
  loadCurrent.value = 0;
  loadPower.value = 0;
  loadSensor.value = false;
  sweepCurveData.value = [];
  sweepHasRun.value = false;
  powerChartData.value = [[], []];
  chartStartTime = null;
};

const handleData = (data) => {
  if (!data) return;

  if (data.event === 'sweep_done') {
    loadSweepData();
    return;
  }

  voltage.value = data.v || 0;
  current.value = data.c || 0;
  power.value = data.p || 0;
  loadVoltage.value = data.loadV || 0;
  loadCurrent.value = data.loadI || 0;
  loadPower.value = data.loadP || 0;
  loadSensor.value = Boolean(data.loadSensor);

  if (data.m) {
    mode.value = data.m;
  }

  if (data.algo) {
    algorithm.value = data.algo;
  }

  if (data.d !== null && data.d !== undefined) {
    const incomingDuty = Math.max(0, Math.min(0.95, Number(data.d)));
    const justSetManualDuty = mode.value === 'MANUAL'
      && Date.now() - lastManualDutySetAt < MANUAL_DUTY_ECHO_GRACE_MS;

    if (!justSetManualDuty || Math.abs(incomingDuty - duty.value) < 0.02) {
      duty.value = incomingDuty;
    }
  }

  updateCharts(data.p || 0);
};

const updateCharts = (p) => {
  const now = Date.now() / 1000;

  if (chartStartTime === null) {
    chartStartTime = now;
  }

  const relativeTime = now - chartStartTime;
  const times = powerChartData.value[0];
  const values = powerChartData.value[1];

  times.push(relativeTime);
  values.push(p);

  if (times.length > MAX_CHART_POINTS) {
    times.shift();
    values.shift();
  }

  powerChartData.value = [times, values];
};

const sendCommand = (command, payload) => {
  if (!connector) return;
  connector.sendCommand(command, payload);
};

const sendSimulationEnvironment = () => {
  if (experimentSource.value !== 'simulation' || !connector) return;

  connector.sendCommand('simulation', {
    sunPosition: simulationSunPosition.value,
    cloudCover: simulationCloudCover.value
  });
};

const setMode = (newMode) => {
  mode.value = newMode;
  sendCommand('set', { mode: newMode });
};

const setAlgorithm = (newAlgo) => {
  algorithm.value = newAlgo;
  sendCommand('set', { algo: newAlgo });
};

const setDuty = (newDuty) => {
  duty.value = newDuty;
  lastManualDutySetAt = Date.now();
  sendCommand('set', { duty: newDuty });
};

const setPreset = (presetId) => {
  selectedPresetId.value = presetId;
  if (experimentSource.value === 'simulation') {
    sendCommand('set', { preset: presetId });
    resetDashboardData();
    scheduleSimulationCurveRefresh();
  }
};

const doSweep = async () => {
  if (!connector) return;

  sweepHasRun.value = true;
  sweepCurveData.value = [];
  await connector.sendCommand('sweep');
  scheduleSweepFallback();
};

const loadSweepData = async () => {
  if (!connector) return;

  clearSweepFallback();

  try {
    const json = await connector.getSweepData();
    if (json && json.points) {
      sweepCurveData.value = json.points;
    }
  } catch (e) {
    console.error('Sweep fetch failed', e);
  }
};

const scheduleSweepFallback = () => {
  clearSweepFallback();
  sweepFallbackTimer = setTimeout(loadSweepData, 5000);
};

const clearSweepFallback = () => {
  if (sweepFallbackTimer) {
    clearTimeout(sweepFallbackTimer);
    sweepFallbackTimer = null;
  }
};

const scheduleSimulationCurveRefresh = () => {
  if (experimentSource.value !== 'simulation') return;

  if (simulationCurveRefreshTimer) {
    clearTimeout(simulationCurveRefreshTimer);
  }

  simulationCurveRefreshTimer = setTimeout(() => {
    simulationCurveRefreshTimer = null;
    loadSweepData();
  }, 80);
};

const clearSimulationCurveRefresh = () => {
  if (simulationCurveRefreshTimer) {
    clearTimeout(simulationCurveRefreshTimer);
    simulationCurveRefreshTimer = null;
  }
};

const setSimulationSunPosition = (value) => {
  simulationSunPosition.value = value;
  sendSimulationEnvironment();
  scheduleSimulationCurveRefresh();
};

const setSimulationCloudCover = (value) => {
  simulationCloudCover.value = value;
  sendSimulationEnvironment();
  scheduleSimulationCurveRefresh();
};

const toggleAdvancedSimulation = () => {
  showAdvancedSimulation.value = !showAdvancedSimulation.value;

  if (showAdvancedSimulation.value) {
    scheduleSimulationCurveRefresh();
  }
};

const connectToSelectedSource = () => {
  if (connector) {
    connector.disconnect();
    connector = null;
  }

  clearSweepFallback();
  clearSimulationCurveRefresh();
  resetDashboardData();
  isConnected.value = experimentSource.value === 'simulation';

  connector = createSensorConnection((data) => {
    isConnected.value = true;
    handleData(data);
  }, experimentSource.value);

  connector.connect();
  if (experimentSource.value === 'simulation') {
    sendCommand('set', { preset: selectedPresetId.value });
  }
  sendSimulationEnvironment();
  scheduleSimulationCurveRefresh();

  if (connector.socket) {
    connector.socket.addEventListener('close', () => {
      if (experimentSource.value === 'real') {
        isConnected.value = false;
      }
    });
  }
};

const setExperimentSource = (source) => {
  if (source === experimentSource.value) return;
  experimentSource.value = source;
  connectToSelectedSource();
};

onMounted(() => {
  connectToSelectedSource();
});

onUnmounted(() => {
  clearSweepFallback();
  clearSimulationCurveRefresh();
  if (connector) connector.disconnect();
});
</script>
