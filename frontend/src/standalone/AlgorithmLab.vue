<template>
  <section class="algorithm-lab" aria-labelledby="algorithm-lab-title">
    <header>
      <div>
        <p class="kicker">Standalone simulation</p>
        <h2 id="algorithm-lab-title">Student / Berry Algorithm Lab</h2>
      </div>
      <span class="runtime-badge">Berry 1.1.0 · Web Worker</span>
    </header>

    <div class="lab-grid">
      <div class="editor-column">
        <label for="berry-editor">Berry controller</label>
        <textarea
          id="berry-editor"
          v-model="code"
          spellcheck="false"
          @input="scheduleCompile"
        />
        <div class="button-row">
          <button @click="run">Run</button>
          <button @click="request('pause')">Pause</button>
          <button @click="request('step')">Single Step</button>
          <button @click="reset">Reset</button>
          <button class="benchmark" @click="benchmark">Benchmark</button>
        </div>
      </div>

      <aside class="lab-side">
        <div class="simulation-inputs">
          <label>Scenario
            <select v-model="scenario" @change="updateEnvironment">
              <option value="">Live sky controls</option>
              <option value="clear-day">Clear day</option>
              <option value="passing-cloud">Passing cloud</option>
            </select>
          </label>
          <label>Ambient temperature
            <span><input v-model.number="ambientC" type="range" min="-10" max="60" step="1" @input="updateEnvironment" /> {{ ambientC }} °C</span>
          </label>
          <label>Load resistance
            <span><input v-model.number="loadOhm" type="range" min="5" max="200" step="1" @input="updateEnvironment" /> {{ loadOhm }} Ω</span>
          </label>
        </div>

        <section class="diagnostics" aria-live="polite">
          <h3>Compile diagnostics</h3>
          <p v-if="!diagnostics.length">Waiting for the interpreter…</p>
          <p v-for="(item, index) in diagnostics" :key="index" :class="item.severity">
            {{ item.message }}
          </p>
        </section>

        <section class="console-output">
          <h3>Console</h3>
          <pre>{{ consoleText }}</pre>
        </section>

        <section v-if="benchmarkRuns.length" class="benchmark-output">
          <h3>Benchmark</h3>
          <p v-for="run in benchmarkRuns" :key="run.scenario">
            {{ run.scenario }}: {{ run.energyJ.toFixed(2) }} J
          </p>
        </section>
      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';

const emit = defineEmits(['command']);

const INITIAL_CODE = `# Return the next duty cycle, clamped by the simulator to 0.02 .. 0.98.
var previous_power = nil
var direction = -1

def mppt(voltage, current, power, duty)
  if previous_power == nil
    previous_power = power
    return duty - 0.05
  end
  if power < previous_power
    direction = -direction
  end
  previous_power = power
  return duty + direction * 0.01
end
`;

const props = defineProps({ consoleLines: { type: Array, default: () => [] } });
const code = ref(INITIAL_CODE);
const diagnostics = ref([]);
const benchmarkRuns = ref([]);
const ambientC = ref(25);
const loadOhm = ref(50);
const scenario = ref('');
let compileTimer = null;

const consoleText = computed(() => props.consoleLines.length ? props.consoleLines.join('\n') : 'Program output will appear here.');

function request(command, params = {}) {
  return new Promise((resolve, reject) => emit('command', { command, params, resolve, reject }));
}

async function compile() {
  const result = await request('compile-student', { code: code.value });
  diagnostics.value = result?.diagnostics ?? [];
  return !diagnostics.value.some(({ severity }) => severity === 'error');
}

function scheduleCompile() {
  clearTimeout(compileTimer);
  compileTimer = setTimeout(() => compile().catch(showError), 180);
}

async function run() {
  if (await compile()) await request('run');
}

async function reset() {
  await compile();
  await request('reset');
}

async function benchmark() {
  const result = await request('benchmark', { code: code.value });
  diagnostics.value = result?.diagnostics ?? [];
  benchmarkRuns.value = result?.runs ?? [];
}

function updateEnvironment() {
  request('simulation', {
    ambientC: ambientC.value,
    loadOhm: loadOhm.value,
    scenario: scenario.value,
  }).catch(showError);
}

function showError(error) {
  diagnostics.value = [{ severity: 'error', message: error instanceof Error ? error.message : String(error) }];
}

onMounted(() => compile().catch(showError));
</script>

<style scoped>
.algorithm-lab { width: min(1760px, 100%); margin: 14px auto 24px; padding: 18px; border: 1px solid #cbd8d3; border-radius: 8px; background: #fff; box-shadow: 0 14px 34px rgba(25, 39, 52, .08); }
header, .button-row, .simulation-inputs label, .simulation-inputs label span { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
header h2, header p, h3, .benchmark-output p { margin: 0; }
.kicker { color: #2f7f66; font-size: .76rem; font-weight: 850; text-transform: uppercase; }
.runtime-badge { padding: 6px 10px; border-radius: 999px; background: #e4f4ec; color: #207652; font-size: .78rem; font-weight: 800; }
.lab-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, .8fr); gap: 16px; margin-top: 16px; }
.editor-column, .lab-side, .simulation-inputs { display: grid; gap: 10px; }
textarea { width: 100%; min-height: 390px; resize: vertical; padding: 14px; border: 1px solid #9fafaa; border-radius: 6px; background: #17212b; color: #e8f1ed; font: 14px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; tab-size: 2; }
.button-row { justify-content: flex-start; flex-wrap: wrap; }
button { padding: 9px 13px; border: 1px solid #9fafaa; border-radius: 5px; background: #f8faf8; cursor: pointer; font-weight: 750; }
button:hover { background: #e8f1ed; }
.benchmark { margin-left: auto; background: #2f7f66; color: #fff; }
.lab-side > section, .simulation-inputs { padding: 12px; border: 1px solid #dfe6e3; border-radius: 6px; background: #f8faf8; }
.simulation-inputs label { align-items: flex-start; flex-direction: column; }
.simulation-inputs label span, select { width: 100%; }
.simulation-inputs input { flex: 1; }
.diagnostics p { padding: 7px; border-radius: 4px; background: #e4f4ec; }
.diagnostics p.error { background: #fde8e5; color: #8b3027; }
pre { min-height: 90px; max-height: 180px; overflow: auto; white-space: pre-wrap; }
@media (max-width: 850px) { .lab-grid { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } }
</style>
