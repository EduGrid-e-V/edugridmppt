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
        <div class="task-note">
          <strong>Your task:</strong> change the converter duty cycle so that <code>PV.getPower()</code>
          becomes as large as possible. The simulator calls <code>mppt()</code> once per MPPT step.
        </div>
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
          <button class="benchmark" :disabled="isBenchmarking" @click="benchmark">
            {{ isBenchmarking ? 'Benchmarking…' : 'Benchmark' }}
          </button>
        </div>

        <section class="benchmark-panel" aria-labelledby="benchmark-title">
          <h3 id="benchmark-title">Benchmark</h3>
          <p>
            Your current program is reset and run in a separate, noise-free simulation for
            <strong>120 simulated seconds</strong> per weather pattern. Each run starts with the
            same duty cycle and empty Berry variables, so repeated tests are directly comparable.
          </p>
          <ul class="benchmark-scenarios">
            <li><strong>Clear day:</strong> sunlight rises and then falls.</li>
            <li><strong>Passing cloud:</strong> irradiance drops suddenly, then recovers.</li>
            <li><strong>Uniform shadow:</strong> light over the whole panel fades to a lower level.</li>
          </ul>
          <p>
            Harvested energy is the sum of <code>PV.getPower() × 0.05 s</code> over all steps.
            The tracking score divides it by the energy available from an ideal controller that
            remains at the maximum-power point. Compare percentages between scenarios; their raw
            joule totals differ because they receive different amounts of light.
          </p>

          <div v-if="benchmarkRuns.length" class="benchmark-output" aria-live="polite">
            <h4>Benchmark results</h4>
            <dl>
              <div v-for="run in benchmarkRuns" :key="run.scenario">
                <dt>{{ scenarioLabel(run.scenario) }}</dt>
                <dd><strong>{{ run.capturePercent.toFixed(1) }}%</strong> · {{ run.energyJ.toFixed(1) }} J harvested / {{ run.availableEnergyJ.toFixed(1) }} J available</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <aside class="lab-side">
        <div class="simulation-inputs">
          <label>Scenario
            <select v-model="scenario" @change="updateEnvironment">
              <option value="">Live sky controls</option>
              <option value="clear-day">Clear day</option>
              <option value="passing-cloud">Passing cloud</option>
              <option value="uniform-shadow">Uniform shadow</option>
            </select>
          </label>
          <p class="fixed-load"><strong>Load:</strong> fixed 50 Ω, matching the real kit.</p>
        </div>

        <section class="api-guide">
          <h3>Firmware-compatible API</h3>
          <dl>
            <div><dt><code>PV.getVoltage()</code></dt><dd>{{ voltage.toFixed(2) }} V</dd></div>
            <div><dt><code>PV.getCurrent()</code></dt><dd>{{ current.toFixed(3) }} A</dd></div>
            <div><dt><code>PV.getPower()</code></dt><dd>{{ power.toFixed(2) }} W</dd></div>
            <div><dt><code>load.getVoltage()</code></dt><dd>{{ loadVoltage.toFixed(2) }} V</dd></div>
            <div><dt><code>load.getCurrent()</code></dt><dd>{{ loadCurrent.toFixed(3) }} A</dd></div>
            <div><dt><code>load.getPower()</code></dt><dd>{{ loadPower.toFixed(2) }} W</dd></div>
            <div><dt><code>duty.get()</code></dt><dd>{{ duty.toFixed(3) }}</dd></div>
          </dl>
          <p><code>duty.set(0.50)</code> chooses a duty directly. <code>duty.change(-0.01)</code> changes it relative to the current value.</p>
          <p class="important"><strong>Buck rule:</strong> increasing duty lowers panel voltage; decreasing duty raises panel voltage.</p>
        </section>

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
          <p class="console-hint"><code>duty.change()</code> controls the simulation but prints nothing. Use <code>print(PV.getPower())</code> when you want console output.</p>
        </section>

        <details class="hints">
          <summary>Hints and controls</summary>
          <ol>
            <li><strong>Single Step</strong> calls <code>mppt()</code> once. Watch the live API values and duty.</li>
            <li>If power increased, try another small change in the same direction.</li>
            <li>If power decreased, reverse the direction of the duty change.</li>
            <li><strong>Run</strong> repeats those steps; <strong>Pause</strong> freezes them; <strong>Reset</strong> clears Berry variables and restores the starting state.</li>
            <li><strong>Benchmark</strong> runs the same program through every deterministic scenario and compares harvested energy.</li>
          </ol>
          <p><strong>Uniform shadow is not partial shading.</strong> It reduces light over the whole panel and therefore has only one power maximum. Real partial shading can create multiple maxima because of cell strings and bypass diodes.</p>
        </details>

      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';

const emit = defineEmits(['command']);

const INITIAL_CODE = `# This uses the same student API as firmware/src/mppt_alg.cpp.
var previous_power = nil
var direction = -1

def mppt()
  var power = PV.getPower()
  if previous_power == nil
    previous_power = power
    duty.change(-0.05)
    return
  end
  if power < previous_power
    direction = -direction
  end
  previous_power = power
  duty.change(direction * 0.01)
end
`;

const props = defineProps({
  consoleLines: { type: Array, default: () => [] },
  voltage: { type: Number, default: 0 }, current: { type: Number, default: 0 }, power: { type: Number, default: 0 },
  loadVoltage: { type: Number, default: 0 }, loadCurrent: { type: Number, default: 0 }, loadPower: { type: Number, default: 0 },
  duty: { type: Number, default: 0 }
});
const code = ref(INITIAL_CODE);
const diagnostics = ref([]);
const benchmarkRuns = ref([]);
const isBenchmarking = ref(false);
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
  isBenchmarking.value = true;
  try {
    const result = await request('benchmark', { code: code.value });
    diagnostics.value = result?.diagnostics ?? [];
    benchmarkRuns.value = result?.runs ?? [];
  } catch (error) {
    showError(error);
  } finally {
    isBenchmarking.value = false;
  }
}

function updateEnvironment() {
  request('simulation', {
    scenario: scenario.value,
  }).catch(showError);
}

function scenarioLabel(id) {
  return ({ 'clear-day': 'Clear day', 'passing-cloud': 'Passing cloud', 'uniform-shadow': 'Uniform shadow' })[id] ?? id;
}

function showError(error) {
  diagnostics.value = [{ severity: 'error', message: error instanceof Error ? error.message : String(error) }];
}

onMounted(() => compile().catch(showError));
</script>

<style scoped>
.algorithm-lab { width: min(1760px, 100%); margin: 14px auto 24px; padding: 18px; border: 1px solid #cbd8d3; border-radius: 8px; background: #fff; box-shadow: 0 14px 34px rgba(25, 39, 52, .08); }
header, .button-row, .simulation-inputs label, .simulation-inputs label span { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
header h2, header p, h3, h4 { margin: 0; }
.kicker { color: #2f7f66; font-size: .76rem; font-weight: 850; text-transform: uppercase; }
.runtime-badge { padding: 6px 10px; border-radius: 999px; background: #e4f4ec; color: #207652; font-size: .78rem; font-weight: 800; }
.lab-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, .8fr); gap: 16px; margin-top: 16px; }
.editor-column, .lab-side, .simulation-inputs { display: grid; gap: 10px; align-content: start; }
textarea { width: 100%; min-height: 390px; resize: vertical; padding: 14px; border: 1px solid #9fafaa; border-radius: 6px; background: #17212b; color: #e8f1ed; font: 14px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; tab-size: 2; }
.button-row { justify-content: flex-start; flex-wrap: wrap; }
button { padding: 9px 13px; border: 1px solid #9fafaa; border-radius: 5px; background: #f8faf8; cursor: pointer; font-weight: 750; }
button:hover { background: #e8f1ed; }
button:disabled { cursor: wait; opacity: .7; }
.benchmark { margin-left: auto; background: #2f7f66; color: #fff; }
.lab-side > section, .simulation-inputs, .benchmark-panel { padding: 12px; border: 1px solid #dfe6e3; border-radius: 6px; background: #f8faf8; }
.task-note, .hints { padding: 10px 12px; border: 1px solid #cbd8d3; border-radius: 6px; background: #f4faf7; line-height: 1.5; }
.api-guide dl { display: grid; gap: 5px; margin: 10px 0; }
.api-guide dl div { display: flex; justify-content: space-between; gap: 12px; }
.api-guide dd { margin: 0; font-variant-numeric: tabular-nums; }
.api-guide p, .console-hint, .fixed-load, .hints p { margin: 8px 0 0; line-height: 1.45; }
.important { color: #8b3027; }
.console-hint { color: #586574; font-size: .82rem; }
.hints summary { cursor: pointer; font-weight: 850; }
.hints ol { padding-left: 20px; line-height: 1.5; }
code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.simulation-inputs label { align-items: flex-start; flex-direction: column; }
.simulation-inputs label span, select { width: 100%; }
.simulation-inputs input { flex: 1; }
.diagnostics p { padding: 7px; border-radius: 4px; background: #e4f4ec; }
.diagnostics p.error { background: #fde8e5; color: #8b3027; }
.benchmark-panel > p { margin: 8px 0 0; line-height: 1.45; color: #46545f; }
.benchmark-scenarios { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0 0; padding: 0; list-style: none; }
.benchmark-scenarios li { padding: 8px; border-radius: 4px; background: #eef5f2; line-height: 1.35; }
.benchmark-output { margin-top: 12px; padding-top: 12px; border-top: 2px solid #cbd8d3; }
.benchmark-output dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0 0; }
.benchmark-output dl div { padding-top: 8px; border-top: 1px solid #dfe6e3; }
.benchmark-output dt { font-weight: 800; }
.benchmark-output dd { margin: 3px 0 0; font-variant-numeric: tabular-nums; }
pre { min-height: 90px; max-height: 180px; overflow: auto; white-space: pre-wrap; }
@media (max-width: 850px) { .lab-grid { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } .benchmark-scenarios, .benchmark-output dl { grid-template-columns: 1fr; } }
</style>
