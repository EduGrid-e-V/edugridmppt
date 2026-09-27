<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-lockup" :aria-label="t('EduGrid MPPT Dashboard')">
        <img class="brand-logo" :src="edugridLogo" :alt="t('EduGrid logo')" />
        <div class="brand-subtitle">{{ t('MPPT Lab Dashboard') }}</div>
      </div>

      <div class="topbar-actions">
        <label class="language-select">
          <span>{{ t('Language') }}</span>
          <select :value="locale" :aria-label="t('Language')" @change="setLocale($event.target.value)">
            <option value="en">English</option>
            <option value="de">Deutsch</option>
            <option value="es">Español</option>
          </select>
        </label>
        <div class="source-switch" role="group" :aria-label="t('Data source')">
          <button
            :class="{ active: experimentSource === 'real' }"
            @click="setExperimentSource('real')"
          >
            {{ t('Real') }}
          </button>
          <button
            :class="{ active: experimentSource === 'simulation' }"
            @click="setExperimentSource('simulation')"
          >
            {{ t('Sim') }}
          </button>
        </div>
        <a v-if="showDeviceDownloads" class="downloads-link" href="/downloads" :aria-label="t('Open experiment recordings')">{{ t('Downloads') }}</a>
        <button
          v-if="experimentSource === 'simulation'"
          class="advanced-toggle"
          :aria-expanded="showAdvancedSimulation"
          @click="toggleAdvancedSimulation"
        >
          {{ t(showAdvancedSimulation ? 'Hide simulation controls' : 'Simulation controls') }}
        </button>
        <div class="connection-pill" :class="{ online: isConnected }">
          <span class="status-dot"></span>
          {{ connectionLabel }}
        </div>
      </div>
    </header>

    <section class="intro-band" :aria-label="t('Experiment overview')">
      <div class="intro-copy-block">
        <p class="eyebrow">{{ t('Solar power electronics trainer') }}</p>
        <h1>{{ t('MPPT lab: observe, sweep, improve.') }}</h1>
        <p class="intro-copy">
          {{ t('Compare panel input and load output while the converter searches for the point where a PV module can deliver the most useful power.') }}
        </p>
        <div class="learning-points" :aria-label="t('Learning goals')">
          <span>{{ t('Measure V, I, P') }}</span>
          <span>{{ t('Compare algorithms') }}</span>
          <span>{{ t('Trace the I–V curve') }}</span>
        </div>
      </div>
      <div class="intro-side">
        <div class="source-summary">
          <span>{{ t('Current workspace') }}</span>
          <strong>{{ t(experimentSource === 'simulation' ? 'Simulation model' : 'Real ESP32 board') }}</strong>
          <p>
            {{ experimentSource === 'simulation'
              ? t('Use sunlight and cloud cover to see why the maximum power point moves.')
              : t('Watch live measurements from the board and test your control algorithm.') }}
          </p>
        </div>
      </div>
    </section>

    <SimulationScene
      v-if="experimentSource === 'simulation' && showAdvancedSimulation"
      :sunPosition="simulationSunPosition"
      :cloudCover="simulationCloudCover"
      :ambientC="simulationAmbientC"
      @update:sunPosition="setSimulationSunPosition"
      @update:cloudCover="setSimulationCloudCover"
      @update:ambientC="setSimulationAmbientC"
    />

    <section class="dashboard-grid" :aria-label="t('MPPT controls and graphs')">
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
        :algorithmOptions="algorithmOptions"
        :panelDescription="panelDescription"
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
        :title="t('Power Over Time')"
        color="#d14b3f"
        :data="powerChartData"
      />
    </section>

    <component
      :is="algorithmLabComponent"
      v-if="algorithmLabComponent && algorithm === 'STUDENT'"
      class="algorithm-lab-row"
      :consoleLines="studentConsole"
      :voltage="voltage"
      :current="current"
      :power="power"
      :loadVoltage="loadVoltage"
      :loadCurrent="loadCurrent"
      :loadPower="loadPower"
      :duty="duty"
      :realHardware="experimentSource === 'real'"
      :berryHealthy="berryHealthy"
      @command="sendLabCommand"
    />
  </main>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, shallowRef } from 'vue';
import ControlPanel from './components/ControlPanel.vue';
import VICurve from './components/VICurve.vue';
import RealtimeChart from './components/RealtimeChart.vue';
import SimulationScene from './components/SimulationScene.vue';
import { createSensorConnection } from './services';
import { locale, setLocale, t } from './i18n.js';
import edugridLogo from './assets/edugrid_logo.svg';
import edugridIcon from './assets/edugrid_icon.svg';

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
const experimentSource = ref(__EDUGRID_STANDALONE__ || import.meta.env.DEV ? 'simulation' : 'real');
const algorithmLabComponent = shallowRef(null);
const showDeviceDownloads = computed(() => !__EDUGRID_STANDALONE__ && !import.meta.env.DEV && experimentSource.value === 'real');
const studentConsole = ref([]);
const berryHealthy = ref(null);
const algorithmOptions = computed(() => {
  const options = [
    { id: 'PNO', label: t('Perturb & Observe') },
    { id: 'INCCOND', label: t('Incremental Conductance') }
  ];
  if (__EDUGRID_STANDALONE__ || experimentSource.value === 'real') {
    options.push({ id: 'STUDENT', label: t('Student / Berry') });
  }
  return options;
});
const showAdvancedSimulation = ref(false);
const simulationSunPosition = ref(0.55);
const simulationCloudCover = ref(0.12);
const simulationAmbientC = ref(25);

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
  if (experimentSource.value === 'simulation') return t('Simulation');
  return t(isConnected.value ? 'Connected' : 'Real experiment offline');
});

const panelDescription = computed(() => experimentSource.value === 'simulation'
  ? `${t('EduGrid kit (~2 W)')} · ${t('Simple real-kit simulation: 13.5 V, 0.18 A, approximately 2 W')}`
  : '');

const visibleCurveData = computed(() => sweepHasRun.value ? sweepCurveData.value : []);

const resetDashboardData = () => {
  voltage.value = 0;
  current.value = 0;
  power.value = 0;
  loadVoltage.value = 0;
  loadCurrent.value = 0;
  loadPower.value = 0;
  loadSensor.value = false;
  berryHealthy.value = null;
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
  if (__EDUGRID_STANDALONE__ && data.event === 'student-console') {
    studentConsole.value = [...studentConsole.value.slice(-199), String(data.line)];
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

  if (typeof data.berryHealthy === 'boolean') berryHealthy.value = data.berryHealthy;

  if (data.d !== null && data.d !== undefined) {
    const incomingDuty = Math.max(0, Math.min(1, Number(data.d)));
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

const sendLabCommand = async ({ command, params, resolve, reject }) => {
  try {
    const result = await connector?.sendCommand(command, params);
    resolve?.(result);
  } catch (error) {
    reject?.(error);
  }
};

const sendSimulationEnvironment = () => {
  if (experimentSource.value !== 'simulation' || !connector) return;

  connector.sendCommand('simulation', {
    sunPosition: simulationSunPosition.value,
    cloudCover: simulationCloudCover.value,
    ambientC: simulationAmbientC.value
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

const setSimulationAmbientC = (value) => {
  simulationAmbientC.value = value;
  sendSimulationEnvironment();
  scheduleSimulationCurveRefresh();
};

const toggleAdvancedSimulation = () => {
  showAdvancedSimulation.value = !showAdvancedSimulation.value;

  if (showAdvancedSimulation.value && sweepHasRun.value) {
    scheduleSimulationCurveRefresh();
  }
};

const connectToSelectedSource = async () => {
  if (connector) {
    connector.disconnect();
    connector = null;
  }

  clearSweepFallback();
  clearSimulationCurveRefresh();
  resetDashboardData();
  isConnected.value = experimentSource.value === 'simulation';

  connector = await createSensorConnection((data) => {
    isConnected.value = true;
    handleData(data);
  }, experimentSource.value);

  connector.connect();
  sendSimulationEnvironment();

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
  const favicon = document.querySelector('link[rel="icon"]') || document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/svg+xml';
  favicon.href = edugridIcon;
  if (!favicon.isConnected) document.head.append(favicon);

  import('./standalone/AlgorithmLab.vue').then(({ default: component }) => {
    algorithmLabComponent.value = component;
  });
  connectToSelectedSource();
});

onUnmounted(() => {
  clearSweepFallback();
  clearSimulationCurveRefresh();
  if (connector) connector.disconnect();
});
</script>
