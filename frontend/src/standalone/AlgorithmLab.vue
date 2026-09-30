<template>
  <section class="algorithm-lab" aria-labelledby="algorithm-lab-title">
    <header>
      <div>
        <p class="kicker">{{ t(realHardware ? 'Real ESP32 experiment' : 'Standalone simulation') }}</p>
        <h2 id="algorithm-lab-title">{{ t('Student / Berry Algorithm Lab') }}</h2>
      </div>
      <span class="runtime-badge">Berry 1.1.0 · {{ realHardware ? 'ESP32' : t('Web Worker') }}</span>
    </header>

    <div class="lab-grid">
      <div class="editor-column">
        <div class="task-note">
          <strong>{{ t('Your task:') }}</strong> {{ t('Change the converter duty cycle so that PV.getPower() becomes as large as possible.') }}
          {{ t(realHardware ? 'The ESP32 calls mppt() every 100 ms.' : 'The simulator calls mppt() every 100 ms.') }}
        </div>
        <textarea
          id="berry-editor"
          :aria-label="t('Berry code editor')"
          v-model="code"
          spellcheck="false"
          @input="scheduleCompile"
        />
        <div class="button-row">
          <button :title="t(realHardware ? 'compiles this program on the ESP32, preserves the previous valid program if compilation fails, then enters Auto mode.' : 'Calls mppt() repeatedly until paused.')" @click="run">{{ t(realHardware ? 'Install & Run' : 'Run') }}</button>
          <button :title="t(realHardware ? 'switches to Manual mode and stops Berry calls.' : 'Pauses repeated mppt() calls.')" @click="pause">{{ t('Pause') }}</button>
          <button v-if="!realHardware" :title="t('calls mppt() once. Watch the live API values and duty.')" @click="request('step')">{{ t('Single Step') }}</button>
          <button :title="t(realHardware ? 'recompiles the editor code and restarts Auto mode.' : 'clears Berry variables and restores the starting state.')" @click="reset">{{ t('Reset') }}</button>
          <button v-if="!realHardware" class="benchmark" :title="t('runs the same program through a deterministic cloudy day and compares harvested energy.')" :disabled="isBenchmarking" @click="benchmark">
            {{ t(isBenchmarking ? 'Benchmarking…' : 'Benchmark') }}
          </button>
          <template v-else>
            <div class="logging-actions">
              <div v-if="!logStatus.recording" class="logging-select">
                <select :value="''" :aria-label="t('Start logging')" :title="t('opens interval choices; selecting one starts a CSV recording.')" :disabled="loggingBusy" @change="startLogging">
                  <option value="" disabled>{{ t('Start logging') }}</option>
                  <option v-for="interval in loggingIntervals" :key="interval.seconds" :value="interval.seconds">
                    {{ t('Every') }} {{ t(interval.label) }}
                  </option>
                </select>
              </div>
              <button v-else class="logging-primary" :title="t('Stops recording and closes the CSV file.')" :disabled="loggingBusy" @click="stopLogging">
                {{ t('Stop logging') }}
              </button>
              <a class="download-button" href="/downloads" :title="t('opens the recordings page for CSV download.')">{{ t('Downloads') }}</a>
            </div>
          </template>
        </div>

        <section v-if="realHardware" class="logging-panel" aria-labelledby="logging-title">
          <h3 id="logging-title">{{ t('Experiment logging') }}</h3>
          <p>{{ t('Record measured PV voltage/current, load voltage/current, and duty cycle to a CSV on the ESP32. A blank load value means its sensor was unavailable.') }}</p>
          <p>{{ logStatus.message ? localizeMessage(logStatus.message) : t('Choose an interval from Start logging to begin recording.') }}
            <span v-if="logStatus.recording"> {{ t('Recording:') }} {{ logStatus.active }}</span>
          </p>
          <p>{{ ((logStatus.usedBytes || 0) / 1048576).toFixed(2) }} / 4.00 MiB {{ t('log budget used.') }}</p>
          <p class="important">{{ t('A filesystem update can erase recordings. Download files you want to keep before updating.') }}</p>
        </section>

        <section v-if="!realHardware" class="benchmark-panel" aria-labelledby="benchmark-title">
          <h3 id="benchmark-title">{{ t('Benchmark') }}</h3>
          <p>{{ t('Benchmark intro') }}</p>
          <figure class="benchmark-profile-chart">
            <svg viewBox="0 0 720 165" role="img" :aria-label="t('Irradiance from sunrise to sunset on a fluctuating benchmark day')">
              <line class="chart-axis" x1="42" y1="10" x2="42" y2="130" />
              <line class="chart-axis" x1="42" y1="130" x2="696" y2="130" />
              <line class="chart-grid" x1="42" y1="70" x2="696" y2="70" />
              <text x="8" y="15">100%</text>
              <text x="16" y="75">50%</text>
              <text x="24" y="134">0%</text>
              <text x="38" y="153">06:00</text>
              <text x="350" y="153">12:00</text>
              <text x="663" y="153">18:00</text>
              <polyline v-for="profile in benchmarkProfiles" :key="profile.id" :class="['scenario-line', profile.className]" :points="profile.points" />
            </svg>
            <figcaption>
              <span v-for="profile in benchmarkProfiles" :key="profile.id" :class="profile.className">{{ t(profile.label) }}</span>
            </figcaption>
          </figure>
          <p>{{ t('Benchmark explanation') }}</p>

          <div v-if="benchmarkRuns.length" class="benchmark-output" aria-live="polite">
            <h4>{{ t('Benchmark results') }}</h4>
            <dl>
              <div v-for="run in benchmarkRuns" :key="run.scenario">
                <dt>{{ scenarioLabel(run.scenario) }}</dt>
                <dd>
                  <strong>{{ run.capturePercent.toFixed(2) }}% {{ t('of available energy') }}</strong> ·
                  {{ joulesToWh(run.energyJ) }} {{ t('Wh harvested /') }} {{ joulesToWh(run.availableEnergyJ) }} {{ t('Wh available') }}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <aside class="lab-side">
        <section class="api-guide">
          <h3>{{ t('Firmware-compatible API') }}</h3>
          <p v-if="!realHardware" class="fixed-load"><strong>{{ t('Load') }}:</strong> {{ t('fixed 25 Ω in this simulation.') }}</p>
          <dl>
            <div><dt><code>PV.getVoltage()</code></dt><dd>{{ voltage.toFixed(2) }} V</dd></div>
            <div><dt><code>PV.getCurrent()</code></dt><dd>{{ current.toFixed(3) }} A</dd></div>
            <div><dt><code>PV.getPower()</code></dt><dd>{{ power.toFixed(2) }} W</dd></div>
            <div><dt><code>load.getVoltage()</code></dt><dd>{{ loadVoltage.toFixed(2) }} V</dd></div>
            <div><dt><code>load.getCurrent()</code></dt><dd>{{ loadCurrent.toFixed(3) }} A</dd></div>
            <div><dt><code>load.getPower()</code></dt><dd>{{ loadPower.toFixed(2) }} W</dd></div>
            <div><dt><code>duty.get()</code></dt><dd>{{ duty.toFixed(3) }}</dd></div>
          </dl>
          <p><code>duty.set(0.50)</code> {{ t('chooses a duty directly.') }} <code>duty.change(-0.01)</code> {{ t('changes it relative to the current value.') }}</p>
          <p class="important"><strong>{{ t('Buck rule:') }}</strong> {{ t('increasing duty lowers panel voltage; decreasing duty raises panel voltage.') }}</p>
        </section>

        <section class="diagnostics" aria-live="polite">
          <h3>{{ t('Compile diagnostics') }}</h3>
          <p v-if="!diagnostics.length">{{ t('Waiting for the interpreter…') }}</p>
          <p v-if="realHardware && berryHealthy === false" class="error">
            {{ t('No healthy Berry program is currently running on the ESP32. Install a valid program; runtime errors and timeouts stop PWM at minimum duty.') }}
          </p>
          <p v-for="(item, index) in diagnostics" :key="index" :class="item.severity">
            {{ localizeMessage(item.message) }}
          </p>
        </section>

        <section class="console-output">
          <div class="console-header">
            <h3>{{ t('Console') }}</h3>
            <label><input v-model="autoScroll" type="checkbox" /> {{ t('Auto-scroll') }}</label>
          </div>
          <pre ref="consoleOutput">{{ consoleText }}</pre>
          <p class="console-hint"><code>duty.change()</code> {{ t('changes duty but prints nothing. Use') }} <code>print(PV.getPower())</code> {{ t('when you want console output.') }}</p>
        </section>

      </aside>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { BENCHMARK_SCENARIOS, sampleScenario } from '../simulation/SimpleSimulation.js';
import { locale, localizeMessage, t } from '../i18n.js';

const emit = defineEmits(['command']);

const INITIAL_CODE = `# This uses the same student API as firmware/src/mppt_alg.cpp.
# mppt() is called every 100 ms. Complete the controller below.

def mppt()
  var voltage = PV.getVoltage()
  var current = PV.getCurrent()
  var power = PV.getPower()
  var current_duty = duty.get()

  # TODO: use the measurements to decide whether duty should change.
  # duty.change(0.01) changes it relative to the current value.
  # duty.set(0.50) chooses a new value directly.
end
`;

const props = defineProps({
  consoleLines: { type: Array, default: () => [] },
  voltage: { type: Number, default: 0 }, current: { type: Number, default: 0 }, power: { type: Number, default: 0 },
  loadVoltage: { type: Number, default: 0 }, loadCurrent: { type: Number, default: 0 }, loadPower: { type: Number, default: 0 },
  duty: { type: Number, default: 0 },
  realHardware: { type: Boolean, default: false },
  berryHealthy: { type: Boolean, default: null }
});
const starterCode = (language) => {
  if (language === 'de') return INITIAL_CODE
    .replace('# This uses the same student API as firmware/src/mppt_alg.cpp.', '# Dieselbe Schüler-API wie in firmware/src/mppt_alg.cpp.')
    .replace('# mppt() is called every 100 ms. Complete the controller below.', '# mppt() wird alle 100 ms aufgerufen. Vervollständige den Regler.')
    .replace('# TODO: use the measurements to decide whether duty should change.', '# TODO: Entscheide anhand der Messwerte, ob sich der Tastgrad ändern soll.')
    .replace('# duty.change(0.01) changes it relative to the current value.', '# duty.change(0.01) ändert ihn relativ zum aktuellen Wert.')
    .replace('# duty.set(0.50) chooses a new value directly.', '# duty.set(0.50) setzt einen neuen Wert direkt.');
  if (language === 'es') return INITIAL_CODE
    .replace('# This uses the same student API as firmware/src/mppt_alg.cpp.', '# La misma API para estudiantes que en firmware/src/mppt_alg.cpp.')
    .replace('# mppt() is called every 100 ms. Complete the controller below.', '# mppt() se llama cada 100 ms. Completa el controlador.')
    .replace('# TODO: use the measurements to decide whether duty should change.', '# TODO: usa las mediciones para decidir si debe cambiar el ciclo de trabajo.')
    .replace('# duty.change(0.01) changes it relative to the current value.', '# duty.change(0.01) lo cambia respecto al valor actual.')
    .replace('# duty.set(0.50) chooses a new value directly.', '# duty.set(0.50) establece directamente un valor nuevo.');
  return INITIAL_CODE;
};
const code = ref(starterCode(locale.value));
watch(locale, (next, previous) => {
  if (code.value === starterCode(previous)) code.value = starterCode(next);
});
const diagnostics = ref([]);
const benchmarkRuns = ref([]);
const isBenchmarking = ref(false);
const loggingIntervals = [
  { seconds: 1, label: '1 second' },
  { seconds: 30, label: '30 seconds' },
  { seconds: 60, label: '1 minute' },
  { seconds: 300, label: '5 minutes' }
];
const loggingBusy = ref(false);
const logStatus = ref({ recording: false, message: '', usedBytes: 0, active: '' });
const autoScroll = ref(true);
const consoleOutput = ref(null);
let compileTimer = null;

const consoleText = computed(() => props.consoleLines.length ? props.consoleLines.join('\n') : t('Program output will appear here.'));

watch([() => props.consoleLines, autoScroll], () => {
  if (autoScroll.value && consoleOutput.value) {
    consoleOutput.value.scrollTop = consoleOutput.value.scrollHeight;
  }
}, { flush: 'post' });

const benchmarkProfiles = BENCHMARK_SCENARIOS.map((scenario, scenarioIndex) => ({
  id: scenario.id,
  label: scenario.label,
  className: `scenario-${scenarioIndex + 1}`,
  points: Array.from({ length: 4321 }, (_, index) => {
    const timeS = scenario.durationS * index / 4320;
    const x = 42 + 654 * index / 4320;
    const y = 10 + 120 * (1 - sampleScenario(scenario, timeS));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" "),
}));

function request(command, params = {}) {
  return new Promise((resolve, reject) => emit('command', { command, params, resolve, reject }));
}

async function compile() {
  const result = await request('compile-student', { code: code.value });
  diagnostics.value = result?.diagnostics ?? [];
  return !diagnostics.value.some(({ severity }) => severity === 'error');
}

function scheduleCompile() {
  if (props.realHardware) {
    diagnostics.value = [{ severity: 'info', message: 'Changes are not on the ESP32 yet. Select Install & Run.' }];
    return;
  }
  clearTimeout(compileTimer);
  compileTimer = setTimeout(() => compile().catch(showError), 180);
}

async function run() {
  if (!(await compile())) return;
  if (props.realHardware) await request('set', { algo: 'STUDENT', mode: 'AUTO' });
  else await request('run');
}

async function pause() {
  if (props.realHardware) await request('set', { mode: 'MANUAL' });
  else await request('pause');
}

async function reset() {
  if (!(await compile())) return;
  if (props.realHardware) await request('set', { algo: 'STUDENT', mode: 'AUTO' });
  else await request('reset');
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

async function refreshLogging() {
  if (!props.realHardware) return;
  logStatus.value = await request('log-status');
}

async function updateLogging(command, params = {}) {
  loggingBusy.value = true;
  try {
    logStatus.value = await request(command, params);
  } catch (error) {
    showError(error);
    await refreshLogging().catch(() => {});
  } finally {
    loggingBusy.value = false;
  }
}

function startLogging(event) {
  const intervalS = Number(event.target.value);
  event.target.value = '';
  if (!loggingIntervals.some((interval) => interval.seconds === intervalS)) return;
  return updateLogging('log-start', { intervalS });
}

function stopLogging() {
  return updateLogging('log-stop');
}

function joulesToWh(joules) {
  return (joules / 3600).toFixed(3);
}

function scenarioLabel(id) {
  return t(BENCHMARK_SCENARIOS.find((scenario) => scenario.id === id)?.label ?? id);
}

function showError(error) {
  diagnostics.value = [{ severity: 'error', message: error instanceof Error ? error.message : String(error) }];
}

onMounted(() => {
  if (!props.realHardware) compile().catch(showError);
  else {
    diagnostics.value = [{ severity: 'info', message: 'Select Install & Run to compile this program on the ESP32.' }];
    refreshLogging().catch(showError);
  }
});
</script>

<style scoped>
.algorithm-lab { width: min(1760px, 100%); margin: 14px auto 24px; padding: 18px; border: 1px solid #cbd8d3; border-radius: 8px; background: #fff; box-shadow: 0 14px 34px rgba(25, 39, 52, .08); }
header, .button-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
header h2, header p, h3, h4 { margin: 0; }
.kicker { color: #2f7f66; font-size: .76rem; font-weight: 850; text-transform: uppercase; }
.runtime-badge { padding: 6px 10px; border-radius: 999px; background: #e4f4ec; color: #207652; font-size: .78rem; font-weight: 800; }
.lab-grid { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(300px, .8fr); gap: 16px; margin-top: 16px; }
.editor-column, .lab-side { display: grid; gap: 10px; align-content: start; }
textarea { width: 100%; min-height: 390px; resize: vertical; padding: 14px; border: 1px solid #9fafaa; border-radius: 6px; background: #17212b; color: #e8f1ed; font: 14px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace; tab-size: 2; }
.button-row { justify-content: flex-start; flex-wrap: wrap; }
button { padding: 9px 13px; border: 1px solid #9fafaa; border-radius: 5px; background: #f8faf8; cursor: pointer; font-weight: 750; }
button:hover:not(:disabled) { background: #e8f1ed; }
button:disabled { cursor: wait; opacity: .7; }
.benchmark { margin-left: auto; }
.logging-actions { display: flex; align-items: stretch; gap: 8px; margin-left: auto; flex-wrap: wrap; }
.logging-select { position: relative; }
.logging-select::after { content: '▾'; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #fff; pointer-events: none; }
.benchmark, .logging-select select, .logging-primary { min-height: 40px; padding: 8px 12px; border: 1px solid #17212b; border-radius: 6px; background: #17212b; color: #fff; font-weight: 850; font-size: .95rem; }
.logging-select select { appearance: none; min-width: 160px; padding-right: 32px; cursor: pointer; color-scheme: dark; }
.logging-select select:disabled { cursor: wait; opacity: .7; }
.benchmark:hover:not(:disabled), .logging-select select:hover:not(:disabled), .logging-primary:hover:not(:disabled) { background: #2f7f66; border-color: #2f7f66; }
.download-button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 8px 12px; border: 1px solid #17212b; border-radius: 6px; color: #17212b; text-decoration: none; font-weight: 850; }
.download-button:hover { background: #e8f1ed; }
.logging-panel p { margin: 8px 0 0; line-height: 1.45; }
.lab-side > section, .benchmark-panel, .logging-panel { padding: 12px; border: 1px solid #dfe6e3; border-radius: 6px; background: #f8faf8; }
.task-note { padding: 10px 12px; border: 1px solid #cbd8d3; border-radius: 6px; background: #f4faf7; line-height: 1.5; }
.api-guide dl { display: grid; gap: 5px; margin: 10px 0; }
.api-guide dl div { display: flex; justify-content: space-between; gap: 12px; }
.api-guide dd { margin: 0; font-variant-numeric: tabular-nums; }
.api-guide p, .console-hint, .fixed-load { margin: 8px 0 0; line-height: 1.45; }
.important { color: #8b3027; }
.console-hint { color: #586574; font-size: .82rem; }
.console-header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.console-header label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: .82rem; }
code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
.diagnostics p { padding: 7px; border-radius: 4px; background: #e4f4ec; }
.diagnostics p.error { background: #fde8e5; color: #8b3027; }
.benchmark-panel > p { margin: 8px 0 0; line-height: 1.45; color: #46545f; }
.benchmark-profile-chart { margin: 10px 0 0; padding: 8px; border-radius: 4px; background: white; }
.benchmark-profile-chart svg { display: block; width: 100%; height: auto; }
.benchmark-profile-chart text { fill: currentColor; font: 11px system-ui, sans-serif; }
.chart-axis { stroke: currentColor; stroke-width: 1; }
.chart-grid { stroke: currentColor; stroke-width: .5; opacity: .25; }
.scenario-line { fill: none; stroke-width: 3; vector-effect: non-scaling-stroke; }
.scenario-1 { color: steelblue; stroke: steelblue; }
.benchmark-profile-chart figcaption { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 20px; font-weight: 750; }
.benchmark-profile-chart figcaption span::before { content: '— '; }
.benchmark-output { margin-top: 12px; padding-top: 12px; border-top: 2px solid #cbd8d3; }
.benchmark-output dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 10px 0 0; }
.diagnostics p.info { background: #eef2f6; color: #46545f; }

.benchmark-output dl div { padding-top: 8px; border-top: 1px solid #dfe6e3; }
.benchmark-output dt { font-weight: 800; }
.benchmark-output dd { margin: 3px 0 0; font-variant-numeric: tabular-nums; }
pre { min-height: 90px; max-height: 180px; overflow: auto; white-space: pre-wrap; }
@media (max-width: 850px) { .lab-grid { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } .benchmark-output dl { grid-template-columns: 1fr; } }
</style>
