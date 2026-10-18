// @ts-check
// Tiny SVG charts (no library): line and bar, with a text summary for screen readers.

import { html } from './lib.js';

/**
 * @param {{ points: { label: string, value: number }[], summary: string, height?: number }} props
 */
export function LineChart({ points, summary, height = 160 }) {
  const w = 320;
  const pad = 24;
  const max = Math.max(...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value));
  const span = max - min || 1;
  const x = (/** @type {number} */ i) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (/** @type {number} */ v) => height - pad - ((v - min) / span) * (height - pad * 2);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join('');
  return html`<figure class="chart">
    <svg viewBox=${`0 0 ${w} ${height}`} role="img" aria-label=${summary} focusable="false">
      <line x1=${pad} x2=${w - pad} y1=${height - pad} y2=${height - pad} class="chart-axis" />
      <path d=${d} class="chart-line" fill="none" />
      ${points.map((p, i) => html`<circle cx=${x(i)} cy=${y(p.value)} r="4" class="chart-dot" />`)}
      <text x=${pad} y=${height - 6} class="chart-label">${points[0]?.label}</text>
      <text x=${w - pad} y=${height - 6} text-anchor="end" class="chart-label">${points[points.length - 1]?.label}</text>
      <text x=${pad} y="14" class="chart-label">${max}</text>
    </svg>
    <figcaption class="field-help">${summary}</figcaption>
  </figure>`;
}

/**
 * @param {{ bars: { label: string, value: number }[], summary: string, height?: number }} props
 */
export function BarChart({ bars, summary, height = 140 }) {
  const w = 320;
  const pad = 20;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const bw = (w - pad * 2) / Math.max(1, bars.length);
  return html`<figure class="chart">
    <svg viewBox=${`0 0 ${w} ${height}`} role="img" aria-label=${summary} focusable="false">
      <line x1=${pad} x2=${w - pad} y1=${height - pad} y2=${height - pad} class="chart-axis" />
      ${bars.map((b, i) => {
        const h = (b.value / max) * (height - pad * 2);
        return html`<rect x=${pad + i * bw + 3} y=${height - pad - h} width=${Math.max(2, bw - 6)} height=${h} rx="3" class="chart-bar" />`;
      })}
      <text x=${pad} y=${height - 4} class="chart-label">${bars[0]?.label}</text>
      <text x=${w - pad} y=${height - 4} text-anchor="end" class="chart-label">${bars[bars.length - 1]?.label}</text>
    </svg>
    <figcaption class="field-help">${summary}</figcaption>
  </figure>`;
}
