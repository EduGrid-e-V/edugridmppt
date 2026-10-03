import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';

function filesBelow(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

const firmwareFiles = filesBelow(resolve('../firmware/data'));
for (const path of firmwareFiles) {
  const filename = basename(path);
  if (Buffer.byteLength(filename, 'utf8') > 31) {
    throw new Error(`Firmware asset filename exceeds the conservative LittleFS limit (31 bytes): ${filename}`);
  }
}
const preflightLoaderFiles = firmwareFiles.filter((path) => /\/preflight-[^/]+\.js$/.test(path));
const simulationWorkerFiles = firmwareFiles.filter((path) => /\/simulation\.worker-[^/]+\.js$/.test(path));
if (preflightLoaderFiles.length !== 1 || simulationWorkerFiles.length !== 2) {
  throw new Error('Firmware build must contain one Berry preflight loader and one shared simulation worker');
}
const preflightLoader = readFileSync(preflightLoaderFiles[0], 'utf8');
const simulationWorkerParts = simulationWorkerFiles.map((path) => readFileSync(path, 'utf8'));
const berryWorkers = simulationWorkerParts.filter((part) => part.includes('berry_compile'));
if (berryWorkers.length !== 1) throw new Error('Firmware build duplicated or omitted the Berry runtime');
if (!preflightLoader.includes('simulation.worker-')) throw new Error('Firmware preflight does not reuse the simulation worker');
const eagerFirmware = firmwareFiles.filter((path) => ![...preflightLoaderFiles, ...simulationWorkerFiles].includes(path))
  .map((path) => readFileSync(path))
  .map((buffer) => buffer.toString('latin1'))
  .join('\n');
if (eagerFirmware.includes('berry_compile')) throw new Error('Berry preflight leaked into the eager firmware dashboard');
const firmware = `${eagerFirmware}\n${preflightLoader}\n${simulationWorkerParts.join('\n')}`;
for (const forbidden of ['Fractional open-circuit voltage', 'Fractional short-circuit current']) {
  if (firmware.includes(forbidden)) throw new Error(`Firmware build contains standalone marker: ${forbidden}`);
}
for (const required of ['Student / Berry Algorithm Lab', 'Install & Run', '/api/berry', 'check-student', 'benchmark']) {
  if (!firmware.includes(required)) throw new Error(`Firmware dashboard is missing ESP32 Berry UI: ${required}`);
}

const standalone = readFileSync(resolve('dist/edugrid-mppt.html'), 'utf8');
// A second inline Berry worker adds roughly 425 kB; leave room for normal UI growth.
if (Buffer.byteLength(standalone) > 850_000) throw new Error('Standalone build likely contains a duplicate Berry preflight worker');
for (const required of ['berry_compile', 'Student / Berry Algorithm Lab', 'Berry 1.1.0']) {
  if (!standalone.includes(required)) throw new Error(`Standalone build is missing: ${required}`);
}
for (const forbidden of ['Fractional open-circuit voltage', 'Fractional short-circuit current', 'FRACTIONAL_VOC', 'FRACTIONAL_ISC']) {
  if (standalone.includes(forbidden)) throw new Error(`Standalone build contains removed algorithm: ${forbidden}`);
}
if (/<script[^>]+src=|<link[^>]+rel=["']stylesheet/.test(standalone)) {
  throw new Error('Standalone HTML contains an external script or stylesheet');
}
console.log('PASS one shared firmware Berry worker for simulation and preflight, ESP32 Berry UI, and standalone asset inlining');
