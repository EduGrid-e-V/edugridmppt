// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import VICurve from '../src/components/VICurve.vue';
import RealtimeChart from '../src/components/RealtimeChart.vue';

describe('I–V chart scale', () => {
  it('keeps the dynamic current axis at or above 200 mA without stretching the SVG', async () => {
    const wrapper = mount(VICurve, {
      props: { voltage: 13.4, current: 0.016, sweepData: [] }
    });
    const labels = wrapper.findAll('.grid > g').slice(-5).map((group) => group.find('text').text());
    expect(labels).toEqual(['0', '0.05', '0.10', '0.15', '0.20']);
    await wrapper.setProps({ current: 0.24 });
    const higherLabels = wrapper.findAll('.grid > g').slice(-5).map((group) => group.find('text').text());
    expect(Number(higherLabels.at(-1))).toBeGreaterThan(0.2);
    expect(wrapper.find('svg.chart-svg').attributes('preserveAspectRatio')).toBe('xMidYMid meet');
    expect(Number(wrapper.find('.plot-bg').attributes('height'))).toBeGreaterThan(350);
  });

  it('starts the voltage axis at 20 V and expands it in 5 V steps', async () => {
    const wrapper = mount(VICurve, {
      props: { voltage: 13.4, current: 0.016, sweepData: [] }
    });
    const labels = () => wrapper.findAll('.grid > g').filter((group) => group.find('line').attributes('x1') === group.find('line').attributes('x2')).map((group) => group.find('text').text());
    expect(labels()).toEqual(['0', '5', '10', '15', '20']);
    await wrapper.setProps({ voltage: 21 });
    expect(labels()).toEqual(['0', '5', '10', '15', '20', '25']);
  });

  it('uses round half-watt ticks on the dynamic I–V power axis', async () => {
    const wrapper = mount(VICurve, {
      props: { voltage: 10, current: 0.02, sweepData: [] }
    });
    const labels = () => wrapper.findAll('.power-scale .tick-label').map((tick) => tick.text());
    expect(labels()).toEqual(['0', '0.5', '1.0', '1.5', '2.0']);

    await wrapper.setProps({ sweepData: [
      { v: 0, i: 0.18, p: 0 },
      { v: 11, i: 0.2, p: 2.2 }
    ] });
    expect(labels()).toEqual(['0', '0.5', '1.0', '1.5', '2.0', '2.5']);
  });

  it('keeps both power scales at or above 2 W and expands in half-watt steps', async () => {
    const wrapper = mount(RealtimeChart, {
      props: { data: [[0, 1, 2], [0.2, 0.2, 0.2]] }
    });
    const getLabels = () => wrapper.findAll('.grid > g').filter((group) => group.find('line').attributes('y1') === group.find('line').attributes('y2')).map((group) => group.find('text').text());
    expect(getLabels()).toEqual(['0', '0.5', '1.0', '1.5', '2.0']);
    const yTicks = wrapper.findAll('.grid > g').slice(-5);
    const plotTop = Number(wrapper.find('.plot-bg').attributes('y'));
    const plotBottom = plotTop + Number(wrapper.find('.plot-bg').attributes('height'));
    expect(Number(yTicks[0].find('line').attributes('y1'))).toBeCloseTo(plotBottom, 6);
    expect(Number(yTicks.at(-1).find('line').attributes('y1'))).toBeCloseTo(plotTop, 6);

    await wrapper.setProps({ data: [[0, 1, 2], [0.2, 2.17, 0.2]] });
    expect(getLabels()).toEqual(['0', '0.5', '1.0', '1.5', '2.0', '2.5']);
    await wrapper.setProps({ data: [[0, 1, 2], [0.2, 0.2, 0.2]] });
    expect(getLabels().at(-1)).toBe('2.5');
    await wrapper.setProps({ data: [[], []] });
    expect(getLabels().at(-1)).toBe('2.0');
    expect(wrapper.find('svg.chart-svg').attributes('preserveAspectRatio')).toBe('xMidYMid meet');
  });
});
