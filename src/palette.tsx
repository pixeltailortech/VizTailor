import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import type { GraphicWalker } from '@kanaries/graphic-walker';
import { PALETTES } from './colorScale';

type GWTheme = ComponentProps<typeof GraphicWalker>['vizThemeConfig'];

export type VizStyle = {
  cat: string[]; // 類別（離散）色盤
  primary: string; // 沒有拖到「顏色」時的預設單色
  sizeMin: number; // 「大小」欄位對應的最小／最大標記面積
  sizeMax: number;
};

export const DEFAULT_STYLE: VizStyle = {
  cat: PALETTES['Tableau 10'],
  primary: '#4e79a7',
  sizeMin: 40, // 預設標記偏小，散佈圖看不清楚；放大後點才顯眼
  sizeMax: 1200,
};

const KEY = 'viztailor.style.v1';
function load(): VizStyle {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && Array.isArray(s.cat)) return { cat: s.cat, primary: s.primary ?? DEFAULT_STYLE.primary, sizeMin: s.sizeMin ?? DEFAULT_STYLE.sizeMin, sizeMax: s.sizeMax ?? DEFAULT_STYLE.sizeMax };
  } catch { /* 無痕或儲存被封鎖：用預設即可 */ }
  return DEFAULT_STYLE;
}

export function useVizStyle() {
  const [style, setStyle] = useState<VizStyle>(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(style)); } catch { /* 同上 */ }
  }, [style]);
  return { style, setStyle };
}

/** 轉成 Graphic Walker 的 theme。ramp = 數值色階（地圖只認這個；一般圖表另由 scales.color 精確指定）。 */
export function buildTheme(style: VizStyle, ramp: string[]): GWTheme {
  const c = style.primary;
  const one = {
    background: 'transparent',
    range: { category: style.cat, ramp, heatmap: ramp, diverging: ramp },
    bar: { fill: c }, circle: { fill: c }, line: { stroke: c }, point: { stroke: c },
    rect: { fill: c }, tick: { fill: c }, area: { fill: c }, arc: { fill: c },
  };
  return { light: one, dark: one } as unknown as GWTheme;
}
