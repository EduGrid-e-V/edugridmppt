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

  await page.getByRole('button', { name: 'Auto MPPT' }).click();
  await page.locator('#algorithm').selectOption('STUDENT');
  await page.getByRole('heading', { name: 'Student / Berry Algorithm Lab' }).waitFor();
  await page.getByText('Berry program compiled successfully.').waitFor({ timeout: 10_000 });

  const editor = page.locator('#berry-editor');
  const validProgram = await editor.inputValue();
  await editor.fill('def not_mppt()\n  return 0.5\nend');
  await page.getByText('Define a function named mppt(v, i, p, duty)').waitFor({ timeout: 10_000 });
  await editor.fill(validProgram);
  await page.getByText('Berry program compiled successfully.').waitFor({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Single Step', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('heading', { name: 'Student / Berry Algorithm Lab' }).waitFor();
  await page.getByRole('button', { name: 'Benchmark', exact: true }).click();
  await page.getByRole('heading', { name: 'Benchmark', exact: true }).waitFor({ timeout: 20_000 });

  if (browserErrors.length) throw new Error(browserErrors.join('\n'));
  console.log('PASS file://, worker telemetry, Berry diagnostics, controls, reset, and benchmark');
} finally {
  await browser.close();
}
