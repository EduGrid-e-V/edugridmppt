import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--allow-file-access-from-files'],
});

try {
  const page = await browser.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto(pathToFileURL(resolve('dist/edugrid-mppt.html')).href);
  await page.waitForFunction(() => {
    const value = document.querySelector('.reading-row.voltage dd span')?.textContent;
    return Number(value) > 0;
  }, null, { timeout: 10_000 });

  if (await page.locator('#panel-preset').count()) throw new Error('Obsolete panel dropdown is visible in simulation mode');
  if (await page.locator('.sweep-path').count()) throw new Error('I-V sweep is visible before Start Sweep');
  await page.getByRole('button', { name: 'Simulation controls' }).click();
  await page.getByText('Ambient temperature').waitFor();

  await page.getByRole('button', { name: 'Auto MPPT' }).click();
  await page.getByRole('button', { name: 'Start Sweep' }).click();
  await page.locator('.sweep-path').waitFor({ timeout: 10_000 });
  await page.locator('#algorithm').selectOption('STUDENT');
  await page.getByRole('heading', { name: 'Student / Berry Algorithm Lab' }).waitFor();
  await page.locator('.benchmark-profile-chart').waitFor();
  if (await page.locator('.benchmark-profile-chart polyline').count() !== 1) throw new Error('Daylight benchmark plot is incomplete');
  await page.getByText('Berry program compiled successfully.').waitFor({ timeout: 10_000 });

  const editor = page.locator('#berry-editor');
  const validProgram = await editor.inputValue();
  await editor.fill('def not_mppt()\n  return 0.5\nend');
  await page.getByText('Define a function named mppt()').waitFor({ timeout: 10_000 });
  await editor.fill(validProgram);
  await page.getByText('Berry program compiled successfully.').waitFor({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Single Step', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('heading', { name: 'Student / Berry Algorithm Lab' }).waitFor();
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await editor.fill('def mppt()\n  duty.set(0.18)\nend');
  await page.getByText('Berry program compiled successfully.').waitFor({ timeout: 10_000 });
  const chartPathBeforeBenchmark = await page.locator('.power-panel .line-path').getAttribute('d');
  await page.getByRole('button', { name: 'Benchmark', exact: true }).click();
  await page.getByRole('heading', { name: 'Benchmark results', exact: true }).waitFor({ timeout: 20_000 });
  const fixedDutyScore = Number.parseFloat(await page.locator('.benchmark-output dd strong').first().textContent());
  if (!(fixedDutyScore < 90)) throw new Error(`Fixed 18% duty scored ${fixedDutyScore}%`);
  await page.waitForFunction((before) => document.querySelector('.power-panel .line-path')?.getAttribute('d') !== before, chartPathBeforeBenchmark);

  if (browserErrors.length) throw new Error(browserErrors.join('\n'));
  console.log('PASS file://, worker telemetry, Berry diagnostics, controls, reset, and benchmark');
} finally {
  await browser.close();
}
