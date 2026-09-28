// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import AlgorithmLab from '../src/standalone/AlgorithmLab.vue';

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
  });
});
