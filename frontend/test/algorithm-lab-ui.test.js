// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AlgorithmLab from '../src/standalone/AlgorithmLab.vue';
import { translations } from '../src/i18n.js';
import { preflightBerry } from '../src/standalone/berry/preflight.js';

vi.mock('../src/standalone/berry/preflight.js', () => ({ preflightBerry: vi.fn() }));

describe('untranslated technical terms', () => {
  it('keeps algorithm names, Benchmark, Duty cycle and Buck Converter in English', () => {
    for (const language of ['de', 'es']) {
      for (const term of ['Perturb & Observe', 'Incremental Conductance', 'Student / Berry', 'Benchmark', 'Duty cycle', 'Buck Converter:']) {
        expect(translations[language][term]).toBe(term);
      }
    }
  });
});

describe('real Berry logging controls', () => {
  it('starts logging from the interval dropdown and keeps Downloads beside it', async () => {
    const commands = [];
    const wrapper = mount(AlgorithmLab, {
      props: {
        realHardware: true,
        onCommand({ command, params, resolve }) {
          commands.push({ command, params });
          resolve({
            recording: command === 'log-start',
            message: '',
            usedBytes: 0,
            active: command === 'log-start' ? 'run-0001.csv' : ''
          });
        }
      }
    });
    await flushPromises();

    const dropdown = wrapper.get('.logging-select select');
    expect(dropdown.findAll('option').map((option) => option.element.value))
      .toEqual(['', '1', '30', '60', '300']);
    expect(wrapper.find('.log-interval').exists()).toBe(false);
    expect(wrapper.get('.logging-actions .download-button').attributes('href')).toBe('/downloads');
    expect(wrapper.find('.logging-panel a[href="/downloads"]').exists()).toBe(false);

    await dropdown.setValue('30');
    await flushPromises();
    expect(commands).toContainEqual({ command: 'log-start', params: { intervalS: 30 } });
    expect(wrapper.find('.logging-select').exists()).toBe(false);

    await wrapper.get('.logging-primary').trigger('click');
    await flushPromises();
    expect(commands).toContainEqual({ command: 'log-stop', params: {} });
    expect(wrapper.find('.logging-select').exists()).toBe(true);
  });

  it('puts control help on the real buttons and removes both hint panels', async () => {
    const wrapper = mount(AlgorithmLab, {
      props: {
        realHardware: true,
        onCommand({ resolve }) {
          resolve({ recording: false, message: '', usedBytes: 0, active: '' });
        }
      }
    });
    await flushPromises();

    expect(wrapper.find('.controls-help, .algorithm-hints').exists()).toBe(false);
    expect(wrapper.get('.button-row button').attributes('title')).toContain('compiles this program');
    expect(wrapper.get('.logging-select select').attributes('title')).toContain('CSV recording');
    expect(wrapper.get('.download-button').attributes('title')).toContain('CSV download');
  });
  it('puts simulation control help on its buttons', () => {
    const wrapper = mount(AlgorithmLab);
    const buttons = wrapper.findAll('.button-row button');
    expect(buttons.map((button) => button.attributes('title'))).toEqual([
      'Calls mppt() repeatedly until paused.',
      'Pauses repeated mppt() calls.',
      'calls mppt() once. Watch the live API values and duty.',
      'clears Berry variables and restores the starting state.',
      'runs the same program through a deterministic cloudy day and compares harvested energy.'
    ]);
    expect(wrapper.find('.controls-help, .algorithm-hints').exists()).toBe(false);
    expect(wrapper.get('.api-guide .important').text()).toContain('draws more panel current and lowers panel voltage');
  });
});

describe('real Berry Install & Run', () => {
  beforeEach(() => preflightBerry.mockReset());

  const mountWithCommands = (commands, compileResult = {
    ok: true, installed: true, healthy: true,
    diagnostics: [{ severity: 'success', message: 'Berry program compiled and installed' }]
  }) => mount(AlgorithmLab, {
    props: {
      realHardware: true,
      onCommand({ command, params, resolve, reject }) {
        commands.push({ command, params });
        if (command === 'compile-student') {
          if (compileResult instanceof Error) reject(compileResult);
          else resolve(compileResult);
        } else resolve({ recording: false, message: '', usedBytes: 0, active: '' });
      }
    }
  });

  it('blocks empty code before preflight or upload', async () => {
    const commands = [];
    const wrapper = mountWithCommands(commands);
    await flushPromises();
    await wrapper.get('#berry-editor').setValue('  ');
    await wrapper.get('.button-row button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.diagnostics .error').text()).toBe('Program is empty');
    expect(preflightBerry).not.toHaveBeenCalled();
    expect(commands.map(({ command }) => command)).not.toContain('compile-student');
  });

  it('preflights source, then installs and enters Auto only after confirmation', async () => {
    preflightBerry.mockResolvedValue([{ severity: 'info', message: 'Berry program compiled successfully.' }]);
    const commands = [];
    const wrapper = mountWithCommands(commands);
    await flushPromises();
    await wrapper.get('.button-row button').trigger('click');
    await flushPromises();
    expect(preflightBerry).toHaveBeenCalledOnce();
    expect(commands.map(({ command }) => command)).toEqual(['log-status', 'compile-student', 'set']);
    expect(commands.at(-1).params).toEqual({ algo: 'STUDENT', mode: 'AUTO' });
    expect(wrapper.get('.button-row button').attributes('disabled')).toBeUndefined();
  });

  it('never uploads code rejected by the local Berry compiler', async () => {
    preflightBerry.mockResolvedValue([{ severity: 'error', message: 'syntax error' }]);
    const commands = [];
    const wrapper = mountWithCommands(commands);
    await flushPromises();
    await wrapper.get('.button-row button').trigger('click');
    await flushPromises();
    expect(wrapper.get('.diagnostics .error').text()).toBe('syntax error');
    expect(commands.map(({ command }) => command)).toEqual(['log-status']);
  });

  it('does not enter Auto after a device rejection or network failure', async () => {
    preflightBerry.mockResolvedValue([{ severity: 'info', message: 'Berry program compiled successfully.' }]);
    const rejectedCommands = [];
    const rejected = mountWithCommands(rejectedCommands, {
      ok: false, installed: false, healthy: false,
      diagnostic: 'Berry upload body is incomplete',
      diagnostics: [{ severity: 'error', message: 'Berry upload body is incomplete' }]
    });
    await flushPromises();
    await rejected.get('.button-row button').trigger('click');
    await flushPromises();
    expect(rejectedCommands.map(({ command }) => command)).toEqual(['log-status', 'compile-student']);
    expect(rejected.get('.diagnostics .error').text()).toContain('incomplete');

    const failedCommands = [];
    const failed = mountWithCommands(failedCommands, new Error('Wi-Fi disconnected'));
    await flushPromises();
    await failed.get('.button-row button').trigger('click');
    await flushPromises();
    expect(failedCommands.map(({ command }) => command)).toEqual(['log-status', 'compile-student']);
    expect(failed.get('.diagnostics .error').text()).toBe('Wi-Fi disconnected');
    expect(failed.get('.button-row button').attributes('disabled')).toBeUndefined();
  });
});
