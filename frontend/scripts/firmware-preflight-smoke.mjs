import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright-core';

const dataRoot = resolve('../firmware/data');
const expectedVersion = `v${JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version}`;
const uploads = [];
const settings = [];
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/api/logging') {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ recording: false, message: '', usedBytes: 0, active: '' }));
    return;
  }
  if (url.pathname === '/api/set') {
    settings.push(Object.fromEntries(url.searchParams));
    response.end('OK');
    return;
  }
  if (url.pathname === '/api/berry' && request.method === 'POST') {
    let source = '';
    for await (const chunk of request) source += chunk.toString('utf8');
    uploads.push({ source, contentType: request.headers['content-type'] });
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({
      ok: true, installed: true, healthy: true,
      diagnostic: 'Berry program compiled and installed',
    }));
    return;
  }
  const file = resolve(dataRoot, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  if (!file.startsWith(`${dataRoot}${sep}`)) {
    response.writeHead(403).end();
    return;
  }
  try {
    response.setHeader('Content-Type', mimeTypes[extname(file)] || 'application/octet-stream');
    response.end(readFileSync(file));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const preflightRequests = [];
  const workerRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/assets/preflight')) preflightRequests.push(request.url());
    if (request.url().includes('/assets/simulation.worker-')) workerRequests.push(request.url());
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  if (await page.locator('.version-tag').textContent() !== expectedVersion) {
    throw new Error('Firmware dashboard version label is missing');
  }
  await page.getByRole('button', { name: 'Auto MPPT' }).click();
  await page.locator('#algorithm').selectOption('STUDENT');
  await page.locator('#berry-editor').waitFor();
  if (preflightRequests.length || workerRequests.length) throw new Error('Berry worker loaded before Install & Run');

  const autoBeforeInstall = settings.filter((entry) => entry.algo === 'STUDENT' && entry.mode === 'AUTO').length;
  await page.locator('#berry-editor').fill('def mppt(');
  await page.getByRole('button', { name: 'Install & Run' }).click();
  await page.locator('.diagnostics .error').waitFor({ timeout: 15_000 });
  if (!preflightRequests.length || !workerRequests.length) {
    throw new Error('Install & Run did not load the shared Berry simulation worker');
  }
  if (uploads.length !== 0) throw new Error('Invalid Berry source was uploaded');
  if (settings.filter((entry) => entry.algo === 'STUDENT' && entry.mode === 'AUTO').length !== autoBeforeInstall) {
    throw new Error('Invalid Berry source entered Auto mode');
  }

  const validSource = 'def mppt()\n  duty.change(-0.01)\nend\n';
  await page.locator('#berry-editor').fill(validSource);
  const installStarted = performance.now();
  await page.getByRole('button', { name: 'Install & Run' }).click();
  await page.getByText('Berry program compiled and installed').waitFor({ timeout: 15_000 });
  await page.waitForFunction(() => document.querySelector('.button-row button')?.disabled === false);
  const localInstallMs = Math.round(performance.now() - installStarted);
  if (uploads.length !== 1 || uploads[0].source !== validSource || uploads[0].contentType !== 'application/octet-stream') {
    throw new Error('Valid Berry source was not uploaded as raw bytes');
  }
  if (settings.filter((entry) => entry.algo === 'STUDENT' && entry.mode === 'AUTO').length !== autoBeforeInstall + 1) {
    throw new Error('Confirmed Berry installation did not enter Auto mode');
  }

  await page.getByRole('button', { name: 'Sim', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('.panel-measurements .reading-row.voltage dd span')?.textContent) > 0);
  await page.getByRole('button', { name: 'Auto MPPT' }).click();
  await page.locator('#algorithm').selectOption('STUDENT');
  await page.getByRole('heading', { name: 'Student / Berry Algorithm Lab' }).waitFor();
  await page.locator('#berry-editor').fill('def mppt()\n  print("SIM_BERRY_TICK")\n  duty.set(0.37)\nend');
  await page.getByText('Berry program compiled successfully.').waitFor({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('.duty-measurements .reading-row.duty dd span')?.textContent) === 37);
  await page.getByText('SIM_BERRY_TICK').first().waitFor();
  if (!(Number(await page.locator('.panel-measurements .reading-row.voltage dd span').textContent()) > 0)) {
    throw new Error('Berry print event reset simulated measurements');
  }
  if (uploads.length !== 1) throw new Error('Simulated Berry code was uploaded to the ESP32');
  console.log(`PASS firmware real-mode preflight and ESP-hosted Berry simulation (${localInstallMs} ms local install)`);
} finally {
  await browser?.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
