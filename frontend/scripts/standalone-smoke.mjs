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
  const headerOk = await page.evaluate(() => {
    const logo = document.querySelector('.brand-logo');
    const language = document.querySelector('.language-select');
    const source = document.querySelector('.source-switch');
    const favicon = document.querySelector('link[rel="icon"]');
    return logo?.complete && logo.naturalWidth > 0 && logo.src.startsWith('data:') &&
      favicon?.href.startsWith('data:') && favicon.href !== logo.src &&
      Boolean(language.compareDocumentPosition(source) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  if (!headerOk) throw new Error('Original logo or language/source switch order is incorrect');
  const chartScale = await page.locator('.vi-panel .chart-svg').evaluate((svg) => {
    const matrix = svg.getScreenCTM();
    return matrix && Math.abs(matrix.a - matrix.d) < 0.01;
  });
  if (!chartScale) throw new Error('I–V chart is stretched along one axis');
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('.vi-panel, .power-panel')];
    return cards.length === 2 && cards.every((card) => {
      const frame = card.querySelector('.graph-frame')?.getBoundingClientRect();
      const plot = card.querySelector('.plot-bg')?.getBoundingClientRect();
      return frame?.height > 0 && plot?.height / frame.height > 0.75;
    });
  }, null, { timeout: 10_000 });

  if (await page.locator('#panel-preset').count()) throw new Error('Obsolete panel dropdown is visible in simulation mode');
  const chartHeight = () => page.locator('.power-panel').evaluate((card) => card.getBoundingClientRect().height);
  const readingSize = () => page.locator('.panel-measurements .reading-row.voltage dd span')
    .evaluate((value) => {
      const bounds = value.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    });
  const simulationHeight = await chartHeight();
  const simulationReadingSize = await readingSize();
  await page.getByRole('button', { name: 'Real', exact: true }).click();
  await page.getByText('Real ESP32 board').waitFor();
  if (await page.locator('#panel-preset, .preset-warning').count()) {
    throw new Error('Obsolete comparison panel is visible in real mode');
  }
  await page.getByText('No ESP32 data. Connect to EduGrid Wi-Fi and open 192.168.4.1.').waitFor();
  const realScale = await page.evaluate(() => ({
    current: [...document.querySelectorAll('.vi-panel .grid > g')]
      .filter((group) => {
        const line = group.querySelector('line');
        return line?.getAttribute('y1') === line?.getAttribute('y2');
      })
      .map((group) => group.querySelector('text')?.textContent.trim()),
    curvePower: [...document.querySelectorAll('.vi-panel .power-scale text')]
      .map((label) => label.textContent.trim()),
    historyPower: [...document.querySelectorAll('.power-panel .grid > g')]
      .filter((group) => {
        const line = group.querySelector('line');
        return line?.getAttribute('y1') === line?.getAttribute('y2');
      })
      .map((group) => group.querySelector('text')?.textContent.trim()),
  }));
  const realCurrent = ['0', '0.01', '0.02', '0.03', '0.04', '0.05'];
  const realPower = ['0', '0.05', '0.10', '0.15', '0.20', '0.25'];
  if (JSON.stringify(realScale.current) !== JSON.stringify(realCurrent) ||
      JSON.stringify(realScale.curvePower) !== JSON.stringify(realPower) ||
      JSON.stringify(realScale.historyPower) !== JSON.stringify(realPower)) {
    throw new Error(`Real charts use the wrong default scale: ${JSON.stringify(realScale)}`);
  }
  const offlineReadings = await page.locator('.panel-measurements .reading-row dd span').allTextContents();
  if (offlineReadings.some((value) => value !== '--')) {
    throw new Error('Offline Real mode must not display zeros as measurements');
  }
  if (Math.abs((await chartHeight()) - simulationHeight) > 2) throw new Error('Real and Simulation chart heights differ');
  const realReadingSize = await readingSize();
  if (Math.abs(realReadingSize.width - simulationReadingSize.width) > 1 ||
      Math.abs(realReadingSize.height - simulationReadingSize.height) > 1) {
    throw new Error('Missing Real reading changes the numeric field size');
  }
  await page.getByRole('button', { name: 'Sim', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('.reading-row.voltage dd span')?.textContent) > 0);
  if (await page.locator('#duty').getAttribute('min') !== '0' || await page.locator('#duty').getAttribute('max') !== '1') {
    throw new Error('Manual duty slider must span 0–100%');
  }
  if (await page.locator('.sweep-path').count()) throw new Error('I-V sweep is visible before Start Sweep');
  await page.getByRole('button', { name: 'Simulation controls' }).click();
  await page.getByText('Ambient temperature').waitFor();
  const manualChartHeight = await chartHeight();
  await page.getByRole('button', { name: 'Auto MPPT' }).click();
  await page.locator('#algorithm option').first().waitFor({ state: 'attached' });
  const autoChartHeight = await chartHeight();
  await page.getByRole('button', { name: 'Manual', exact: true }).click();
  await page.locator('.manual-input').waitFor();
  const manualAgainChartHeight = await chartHeight();
  if (manualChartHeight > 650 || autoChartHeight < manualChartHeight || Math.abs(manualAgainChartHeight - manualChartHeight) > 1) {
    throw new Error('Power chart retained Auto-mode height or has excessive default whitespace');
  }
  await page.getByRole('button', { name: 'Auto MPPT' }).click();
  await page.locator('#algorithm option').first().waitFor({ state: 'attached' });
  const algorithms = await page.locator('#algorithm option').evaluateAll(options => options.map(option => option.value));
  if (JSON.stringify(algorithms) !== JSON.stringify(['PNO', 'INCCOND', 'STUDENT'])) {
    throw new Error(`Unexpected MPPT algorithms: ${algorithms.join(', ')}`);
  }
  await page.getByRole('button', { name: 'Start Sweep' }).click();
  await page.locator('.sweep-path').waitFor({ timeout: 10_000 });
  await page.locator('#algorithm').selectOption('STUDENT');
  await page.getByRole('heading', { name: 'Student / Berry Algorithm Lab' }).waitFor();
  if (await page.getByText('Berry controller', { exact: true }).count()) throw new Error('Redundant Berry controller label is visible');
  if (await page.locator('.simulation-inputs').count()) throw new Error('Obsolete scenario selector is visible');
  if (await page.getByRole('textbox', { name: 'Berry code editor' }).count() !== 1) throw new Error('Berry editor needs an accessible label');
  await page.locator('.benchmark-profile-chart').waitFor();
  if (await page.locator('.benchmark-profile-chart polyline').count() !== 1) throw new Error('Daylight benchmark plot is incomplete');
  await page.getByText('Berry program compiled successfully.').waitFor({ timeout: 10_000 });
  const actionStyle = (locator) => locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      border: style.borderTopColor,
      color: style.color,
      fontSize: style.fontSize
    };
  });
  const sweepButton = page.locator('.action-btn.sweep');
  const benchmarkButton = page.getByRole('button', { name: 'Benchmark', exact: true });
  await page.mouse.move(0, 0);
  const sweepIdle = await actionStyle(sweepButton);
  const benchmarkIdle = await actionStyle(benchmarkButton);
  await sweepButton.hover();
  const sweepHover = await actionStyle(sweepButton);
  await benchmarkButton.hover();
  const benchmarkHover = await actionStyle(benchmarkButton);
  if (JSON.stringify(sweepIdle) !== JSON.stringify(benchmarkIdle) ||
      JSON.stringify(sweepHover) !== JSON.stringify(benchmarkHover)) {
    throw new Error(`Benchmark styling differs from Start Sweep: ${JSON.stringify({ sweepIdle, benchmarkIdle, sweepHover, benchmarkHover })}`);
  }

  const editor = page.locator('#berry-editor');
  const validProgram = await editor.inputValue();
  const language = page.getByRole('combobox', { name: 'Language' });
  await language.selectOption('de');
  const germanGoals = await page.locator('.learning-points').evaluate((goals) => {
    const intro = goals.closest('.intro-copy-block');
    const first = goals.querySelector('span');
    return intro && Math.abs(first.getBoundingClientRect().left - intro.getBoundingClientRect().left) < 2;
  });
  if (!germanGoals) throw new Error('German learning goals are not aligned under the introduction');
  await page.getByRole('heading', { name: 'Algorithmuslabor für Schüler / Berry' }).waitFor();
  await page.getByRole('button', { name: 'Kennlinie messen' }).waitFor();
  await page.getByRole('heading', { name: 'U-I-Kennlinie' }).waitFor();
  await page.locator('.benchmark-panel').getByText('Dein Programm wird über einen ganzen Tag', { exact: false }).waitFor();
  await page.getByRole('combobox', { name: 'Sprache' }).selectOption('es');
  await page.getByRole('heading', { name: 'Laboratorio de algoritmos del estudiante / Berry' }).waitFor();
  await page.getByRole('button', { name: 'Medir curva' }).waitFor();
  await page.getByRole('heading', { name: 'Curva I–V' }).waitFor();
  await page.locator('.benchmark-panel').getByText('Tu programa se prueba durante un día completo', { exact: false }).waitFor();
  await page.getByRole('combobox', { name: 'Idioma' }).selectOption('en');
  await page.getByRole('heading', { name: 'Student / Berry Algorithm Lab' }).waitFor();
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
  await page.getByRole('combobox', { name: 'Language' }).selectOption('de');
  if (await editor.inputValue() !== 'def mppt()\n  duty.set(0.18)\nend') throw new Error('Language switch overwrote edited Berry code');
  await page.getByRole('combobox', { name: 'Sprache' }).selectOption('en');
  const chartPathBeforeBenchmark = await page.locator('.power-panel .line-path').getAttribute('d');
  await page.getByRole('button', { name: 'Benchmark', exact: true }).click();
  await page.getByRole('heading', { name: 'Benchmark results', exact: true }).waitFor({ timeout: 20_000 });
  const fixedDutyScore = Number.parseFloat(await page.locator('.benchmark-output dd strong').first().textContent());
  if (!(fixedDutyScore < 90)) throw new Error(`Fixed 18% duty scored ${fixedDutyScore}%`);
  await page.waitForFunction((before) => document.querySelector('.power-panel .line-path')?.getAttribute('d') !== before, chartPathBeforeBenchmark);
  await editor.fill('def mppt()\n  print("BENCHMARK_TICK")\n  duty.set(0.18)\nend');
  await page.getByText('Berry program compiled successfully.').waitFor({ timeout: 10_000 });
  await benchmarkButton.click();
  await page.getByText('Benchmark print output suppressed (432000 lines).').waitFor({ timeout: 60_000 });
  const printedDutyScore = Number.parseFloat(await page.locator('.benchmark-output dd strong').first().textContent());
  if (Math.abs(printedDutyScore - fixedDutyScore) > 0.01) {
    throw new Error(`Berry print changed benchmark score: ${fixedDutyScore}% versus ${printedDutyScore}%`);
  }
  const consoleTextAfterBenchmark = await page.locator('.console-output pre').textContent();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Single Step', exact: true }).click();
  await page.waitForFunction((before) => {
    const next = document.querySelector('.console-output pre')?.textContent;
    return next !== before && next?.includes('BENCHMARK_TICK');
  }, consoleTextAfterBenchmark, { timeout: 10_000 });

  if (browserErrors.length) throw new Error(browserErrors.join('\n'));
  console.log('PASS file://, worker telemetry, Berry diagnostics, controls, reset, and benchmark');
} finally {
  await browser.close();
}
