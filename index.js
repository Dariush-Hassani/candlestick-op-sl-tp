import CandleStickChart from './candleStickChart.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

let data = await d3.json('data.json');
data = data.candles;

let chart = new CandleStickChart(
  window.innerWidth,
  window.innerHeight,
  data,
  'chart1'
);
chart.draw();

window.addEventListener('resize', () => {
  chart.setConfig({ width: window.innerWidth, height: window.innerHeight });
  chart.draw();
});
