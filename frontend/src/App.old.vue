<template>
  <div class="app-container">
    <header>
      <h1>MPPT Dashboard</h1>
      <div class="status" :class="{ connected: isConnected }">
        {{ isConnected ? 'CONNECTED' : 'DISCONNECTED' }}
      </div>
    </header>

    <main>
      <!-- 1. Control Panel -->
      <ControlPanel 
        :mode="mode"
        :algorithm="algorithm"
        :duty="duty"
        :power="power"
        :voltage="voltage"
        @update:mode="setMode"
        @update:algorithm="setAlgorithm"
        @update:duty="setDuty"
        @trigger:sweep="doSweep"
      />

      <div class="visualizations">
        <!-- 2. VI Curve -->
        <VICurve 
          :voltage="voltage"
          :current="current"
          :sweepData="sweepCurveData"
          :width="500"
          :height="400"
        />

        <!-- 3. Realtime Chart (Power) -->
        <RealtimeChart 
          title="Power (W)"
          color="#e74c3c"
          :data="powerChartData"
          :width="500"
          :height="400"
        />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import ControlPanel from './components/ControlPanel.vue';
import VICurve from './components/VICurve.vue';
import RealtimeChart from './components/RealtimeChart.vue';
import { createSensorConnection } from './services';

// State
const isConnected = ref(false);
const voltage = ref(0);
const current = ref(0);
const power = ref(0);
const duty = ref(0);
const mode = ref('MANUAL');
const algorithm = ref('PNO');

// Sweep Data
const sweepCurveData = ref([]); 

// Chart Data: [ [times], [values] ]
const powerChartData = ref([ [], [] ]);
const MAX_CHART_POINTS = 300; 

let connector = null;

// Methods
const handleData = (data) => {
  // data: { "v": 12.5, "c": 3.0, "p": 37.5, "d": 0.5, "m": "AUTO" }
  if (!data) return;
  voltage.value = data.v || 0;
  current.value = data.c || 0;
  power.value = data.p || 0;
  duty.value = data.d || 0;
  mode.value = data.m || 'MANUAL';
  
  updateCharts(data.p);
};

const updateCharts = (p) => {
  const now = Date.now() / 1000;
  let times = powerChartData.value[0];
  let values = powerChartData.value[1];

  times.push(now);
  values.push(p);

  if (times.length > MAX_CHART_POINTS) {
    times.shift();
    values.shift();
  }
  
  // Trigger reactivity by creating a new array reference for uPlot to detect change if needed
  // But uPlot usually watches the array. However, pure Vue reactivity might need new ref.
  powerChartData.value = [times, values]; 
};

const setMode = (newMode) => {
  mode.value = newMode;
  connector.sendCommand('set', { mode: newMode });
};

const setAlgorithm = (newAlgo) => {
  algorithm.value = newAlgo; 
  connector.sendCommand('set', { algo: newAlgo });
};

const setDuty = (newDuty) => {
  duty.value = newDuty; 
  connector.sendCommand('set', { duty: newDuty });
};

const doSweep = async () => {
  console.log("Starting Sweep...");
  sweepCurveData.value = []; // clear old
  await connector.sendCommand('sweep');
  
  // Wait 4 seconds
  setTimeout(async () => {
    try {
      const json = await connector.getSweepData();
      if (json && json.points) {
        sweepCurveData.value = json.points;
      }
    } catch (e) {
      console.error("Failed to fetch sweep data", e);
    }
  }, 4000);

};

onMounted(() => {
  connector = createSensorConnection((data) => {
    isConnected.value = true;
    handleData(data);
  });
  
  if (connector.socket) {
      connector.socket.addEventListener('close', () => isConnected.value = false);
  }
  
  connector.connect();
});

onUnmounted(() => {
  if (connector) connector.disconnect();
});
</script>

<style>
body {
  margin: 0;
  background: #111;
  color: #eee;
  font-family: 'Segoe UI', sans-serif;
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.status {
  padding: 5px 10px;
  background: #c0392b;
  border-radius: 4px;
  font-weight: bold;
}
.status.connected {
  background: #27ae60;
}

.visualizations {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  margin-top: 20px;
}
</style>
