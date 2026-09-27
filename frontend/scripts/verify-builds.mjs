import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function filesBelow(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

const firmware = filesBelow(resolve('../firmware/data'))
  .map((path) => readFileSync(path))
  .map((buffer) => buffer.toString('latin1'))
  .join('\n');
for (const forbidden of ['berry_compile', 'student-console', 'data:application/wasm', 'Fractional open-circuit voltage', 'Fractional short-circuit current']) {
  if (firmware.includes(forbidden)) throw new Error(`Firmware build contains standalone marker: ${forbidden}`);
}
for (const required of ['Student / Berry Algorithm Lab', 'Install & Run', '/api/berry']) {
  if (!firmware.includes(required)) throw new Error(`Firmware dashboard is missing ESP32 Berry UI: ${required}`);
}

const standalone = readFileSync(resolve('dist/edugrid-mppt.html'), 'utf8');
for (const required of ['berry_compile', 'Student / Berry Algorithm Lab', 'Berry 1.1.0']) {
  if (!standalone.includes(required)) throw new Error(`Standalone build is missing: ${required}`);
}
for (const forbidden of ['Fractional open-circuit voltage', 'Fractional short-circuit current', 'FRACTIONAL_VOC', 'FRACTIONAL_ISC']) {
  if (standalone.includes(forbidden)) throw new Error(`Standalone build contains removed algorithm: ${forbidden}`);
}
if (/<script[^>]+src=|<link[^>]+rel=["']stylesheet/.test(standalone)) {
  throw new Error('Standalone HTML contains an external script or stylesheet');
}
console.log('PASS browser-WASM isolation, ESP32 Berry UI, and standalone asset inlining');
