/** 色彩的純函式與色盤資料（不含 React，方便測試） */
export type ColorMaps = Record<string, Record<string, string>>;
export type Val = string | number;
export type Extent = { min: number; max: number };

/** 類別色盤 */
export const PALETTES: Record<string, string[]> = {
  'Tableau 10': ['#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac'],
  'Tableau 20': ['#4e79a7', '#a0cbe8', '#f28e2b', '#ffbe7d', '#59a14f', '#8cd17d', '#b6992d', '#f1ce63', '#499894', '#86bcb6', '#e15759', '#ff9d9a', '#79706e', '#bab0ac', '#d37295', '#fabfd2', '#b07aa1', '#d4a6c8', '#9d7660', '#d7b5a6'],
  色盲: ['#1170aa', '#fc7d0b', '#a3acb9', '#57606c', '#5fa2ce', '#c85200', '#7b848f', '#a3cce9', '#ffbc79', '#c8d0d9'],
  'Tableau Classic 10': ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'],
  交通燈: ['#b10318', '#dba13a', '#309343', '#d82526', '#ffc156', '#69b764', '#f26c64', '#ffdd71', '#9fcd99'],
  高對比: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999', '#17becf', '#111111'],
  柔和: ['#8dd3c7', '#fdb462', '#bebada', '#fb8072', '#80b1d3', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5'],
  灰階: ['#2b2b2b', '#555555', '#7f7f7f', '#a9a9a9', '#d3d3d3'],
};

/** 數值用的色帶（低 → 高） */
export const RAMPS: Record<string, string[]> = {
  藍色: ['#eff3ff', '#bdd7e7', '#6baed6', '#3182bd', '#08519c'],
  橘色: ['#feedde', '#fdbe85', '#fd8d3c', '#e6550d', '#a63603'],
  綠色: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
  紅色: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
  紫色: ['#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
  褐色: ['#f1e2cc', '#dcbf9a', '#c69c6d', '#a97647', '#7d4f25'],
  灰色: ['#f0f0f0', '#cccccc', '#969696', '#636363', '#252525'],
  '藍色—藍綠色': ['#bce4d8', '#7fc4c7', '#49a4b9', '#3581a5', '#2c5985'],
  '橘色—金色': ['#f4d166', '#f6a347', '#ef701b', '#cf4f22', '#9e3a26'],
  '綠色—金色': ['#f4d166', '#b8c95a', '#7bb85c', '#3f9e62', '#146c36'],
  '紅色—金色': ['#f4d166', '#f6a347', '#ef701b', '#d9412a', '#b71d3e'],
  '橘色—藍色發散': ['#d95f02', '#fdb97d', '#f7f7f7', '#92c5de', '#1f78b4'],
  '紅色—綠色發散': ['#d73027', '#fdae61', '#ffffbf', '#a6d96a', '#1a9850'],
  '紅色—藍色發散': ['#b2182b', '#f4a582', '#f7f7f7', '#92c5de', '#2166ac'],
  '綠色—藍色發散': ['#24693d', '#9bcf9a', '#f7f7f7', '#9fc5df', '#2a5783'],
  '紅色—黑色發散': ['#ae123a', '#e58a8a', '#e0e0e0', '#8a8a8a', '#1e1e1e'],
  '金色—紫色發散': ['#ad9024', '#e3d8a3', '#f7f7f7', '#c9aed6', '#5c3696'],
  溫度發散: ['#529985', '#a8d0bd', '#f2e8c4', '#e5a17a', '#c33b31'],
};
const isDiverging = (name: string) => name.endsWith('發散');

/** 在色帶上取 t（0..1）位置的顏色（線性內插） */
export function rampAt(stops: string[], t: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  const a = parseInt(stops[i].slice(1), 16), b = parseInt(stops[i + 1].slice(1), 16);
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - f) + ((b >> s) & 255) * f);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

/** 一個數值欄位的色彩設定（對應 Tableau「編輯色彩」的選項）；start／center／end 沒填 = 自動 */
export type QuantCfg = { palette: string; steps: number; reverse: boolean; start?: number; center?: number; end?: number; full?: boolean };
export const DEFAULT_QUANT: QuantCfg = { palette: '自動', steps: 0, reverse: false };

export type Resolved = { name: string; stops: string[]; div: boolean; start: number; end: number; center: number };
/** 把設定＋資料範圍解析成實際要用的色帶與 開始／置中／結束。「自動」：有正有負用橘藍發散，否則藍色。 */
export function resolveQuant(cfg: QuantCfg, ext: Extent | null): Resolved {
  const auto = !RAMPS[cfg.palette];
  const name = auto ? (ext && ext.min < 0 && ext.max > 0 ? '橘色—藍色發散' : '藍色') : cfg.palette;
  const div = isDiverging(name);
  const start = cfg.start ?? ext?.min ?? 0;
  let end = cfg.end ?? ext?.max ?? 1;
  if (!(end > start)) end = start + 1;
  let center = cfg.center ?? (start < 0 && end > 0 ? 0 : (start + end) / 2);
  if (!(center > start && center < end)) center = (start + end) / 2;
  return { name, stops: RAMPS[name], div, start, end, center };
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
/** 數值 → 色帶位置（0..1）。發散色帶預設以「置中」為中心左右對稱；full = 兩端都用到最深。 */
export function tOf(r: Resolved, v: number, full?: boolean): number {
  if (!r.div) return clamp01((v - r.start) / (r.end - r.start));
  if (full) return clamp01(v < r.center ? 0.5 * (v - r.start) / (r.center - r.start) : 0.5 + 0.5 * (v - r.center) / (r.end - r.center));
  return clamp01(0.5 + (v - r.center) / (2 * Math.max(r.center - r.start, r.end - r.center)));
}
/** tOf 的反函式：色帶位置 → 數值 */
export function vOf(r: Resolved, t: number, full?: boolean): number {
  if (!r.div) return r.start + t * (r.end - r.start);
  if (full) return t < 0.5 ? r.start + 2 * t * (r.center - r.start) : r.center + 2 * (t - 0.5) * (r.end - r.center);
  return r.center + (t - 0.5) * 2 * Math.max(r.center - r.start, r.end - r.center);
}
function colorOfT(r: Resolved, cfg: QuantCfg, t: number): string {
  const n = cfg.steps >= 2 ? Math.min(20, Math.floor(cfg.steps)) : 0;
  let x = cfg.reverse ? 1 - t : t;
  if (n) x = Math.min(n - 1, Math.floor(x * n)) / (n - 1);
  return rampAt(r.stops, x);
}
/** 某個數值的顏色 */
export function colorOf(cfg: QuantCfg, ext: Extent | null, v: number): string {
  const r = resolveQuant(cfg, ext);
  return colorOfT(r, cfg, tOf(r, v, cfg.full));
}

/**
 * 從 lo 到 hi 等距取 n 個顏色。
 * - 地圖：Graphic Walker 的地圖只會把 theme 的色階「等距鋪在資料最小～最大值」上做線性內插，
 *   所以把 開始／置中／結束／分步 都先算進這 n 個顏色裡（lo／hi = 地圖資料的最小／最大）。
 * - 對話框的預覽色條：lo／hi = 開始／結束。
 */
export function sampleColors(cfg: QuantCfg, ext: Extent | null, n: number, over: 'data' | 'range' = 'data'): string[] {
  const r = resolveQuant(cfg, ext);
  const lo = over === 'data' && ext ? ext.min : r.start, hi = over === 'data' && ext ? ext.max : r.end;
  return Array.from({ length: n }, (_, i) => colorOfT(r, cfg, tOf(r, lo + (hi - lo) * (i / (n - 1)), cfg.full)));
}

/** 給 vega 圖表的色階設定（直接變成 encoding.color.scale） */
export function quantScale(cfg: QuantCfg, ext: Extent): Record<string, unknown> {
  const r = resolveQuant(cfg, ext);
  const n = cfg.steps >= 2 ? Math.min(20, Math.floor(cfg.steps)) : 0;
  if (n) {
    return {
      type: 'threshold',
      domain: Array.from({ length: n - 1 }, (_, k) => vOf(r, (k + 1) / n, cfg.full)),
      range: Array.from({ length: n }, (_, k) => colorOfT(r, cfg, (k + 0.5) / n)),
    };
  }
  const k = r.stops.length;
  return {
    domain: Array.from({ length: k }, (_, i) => vOf(r, i / (k - 1), cfg.full)),
    range: Array.from({ length: k }, (_, i) => colorOfT(r, cfg, i / (k - 1))),
    clamp: true, nice: false, zero: false,
  };
}

const cmp = (a: Val, b: Val) => (typeof a === 'number' && typeof b === 'number' ? a - b : a < b ? -1 : a > b ? 1 : 0);

/** 某欄位的所有不同值（保留原始型別），由小到大，與 vega 預設排序一致 */
export function distinctValues(rows: Array<Record<string, unknown>>, fid: string, limit = 5000): Val[] {
  const s = new Map<string, Val>();
  for (const r of rows) {
    const v = r[fid];
    if (v == null || v === '') continue;
    const k = String(v);
    if (!s.has(k)) {
      s.set(k, typeof v === 'number' ? v : k);
      if (s.size >= limit) break;
    }
  }
  return [...s.values()].sort(cmp);
}

export type Info = { semanticType: string; theme: string; values: unknown[] };
type ScaleOpts = {
  maps: ColorMaps; // 類別：欄位 → 值 → 顏色
  cat: string[]; // 類別色盤（沒指定的值用它）
  quant: QuantCfg; // 目前圖表的數值色彩設定
  onExtent?: (e: Extent) => void; // 回報圖表實際的數值範圍（對話框要顯示）
};
/** 交給 `<GraphicWalker scales={{ color }}>` 的函式：吃「顏色」欄位在圖上的所有值，回傳 vega 的色階。 */
export function makeColorScale({ maps, cat, quant, onExtent }: ScaleOpts) {
  const fids = Object.keys(maps).filter((f) => Object.keys(maps[f]).length > 0);
  return (info: Info): Record<string, unknown> => {
    if (info.semanticType === 'temporal') return {};
    if (info.semanticType === 'quantitative') {
      let min = Infinity, max = -Infinity;
      for (const v of info.values) {
        if (v == null || v === '') continue;
        const x = Number(v);
        if (!Number.isFinite(x)) continue;
        if (x < min) min = x;
        if (x > max) max = x;
      }
      if (!(max >= min)) return {};
      onExtent?.({ min, max });
      return max > min ? quantScale(quant, { min, max }) : {};
    }
    if (fids.length === 0) return {};
    const seen = new Map<string, Val>();
    for (const v of info.values) {
      if (v == null || v === '') continue;
      const k = String(v);
      if (!seen.has(k)) seen.set(k, typeof v === 'number' ? v : k);
    }
    // 這個圖的顏色欄位是哪一個？以「對應表的值與實際值重疊最多」的欄位為準
    let best: string | null = null, bestN = 0;
    for (const f of fids) {
      let n = 0;
      for (const k of Object.keys(maps[f])) if (seen.has(k)) n++;
      if (n > bestN) { bestN = n; best = f; }
    }
    if (!best) return {};
    const map = maps[best];
    const domain = [...seen.values()].sort(cmp);
    return { domain, range: domain.map((v, i) => map[String(v)] ?? cat[i % cat.length]) };
  };
}

type VF = { fid: string; analyticType?: string; aggName?: string; rule?: { type?: string; value?: unknown } | null };
/** 圖表設定的精簡版（App 從 Graphic Walker 的 store 取出） */
export type VisLite = { c?: string; a?: boolean; e?: Record<string, VF[]> };

/**
 * 自己算出「地圖上顏色度量的最小／最大值」。Graphic Walker 的地圖不會把資料交給我們，
 * 所以照它的規則重算：套篩選 → 依圖上的維度分組 → 彙總。算不出來（不支援的彙總／篩選）回傳 null。
 */
export function mapExtent(vis: VisLite, rows: Array<Record<string, unknown>>): Extent | null {
  const e = vis.e ?? {};
  const col = e.color?.[0];
  if (!col || col.analyticType !== 'measure' || rows.length === 0) return null;
  const isCount = col.fid === 'gw_count_fid';
  if (!isCount && !(col.fid in rows[0])) return null;

  const tests: Array<(r: Record<string, unknown>) => boolean> = [];
  for (const f of e.filters ?? []) {
    const rule = f.rule;
    if (!rule) continue;
    const val = rule.value;
    if (rule.type === 'one of' || rule.type === 'not in') {
      const set = new Set(Array.isArray(val) ? val.map(String) : []);
      const want = rule.type === 'one of';
      tests.push((r) => set.has(String(r[f.fid])) === want);
    } else if (rule.type === 'range' && Array.isArray(val)) {
      const [a, b] = val.map(Number);
      tests.push((r) => { const x = Number(r[f.fid]); return x >= a && x <= b; });
    } else if (rule.type === 'temporal range' && Array.isArray(val)) {
      const [a, b] = val.map(Number);
      tests.push((r) => { const x = new Date(r[f.fid] as string).getTime(); return x >= a && x <= b; });
    } else return null;
  }
  const num = (r: Record<string, unknown>) => (isCount ? 1 : r[col.fid] == null || r[col.fid] === '' ? NaN : Number(r[col.fid]));

  let min = Infinity, max = -Infinity;
  const take = (x: number) => { if (Number.isFinite(x)) { if (x < min) min = x; if (x > max) max = x; } };
  const agg = vis.a ? col.aggName : undefined;
  if (!agg) {
    for (const r of rows) if (tests.every((t) => t(r))) take(num(r));
  } else {
    if (!['sum', 'mean', 'count', 'min', 'max', 'median'].includes(agg)) return null;
    const dims: string[] = [];
    for (const ch of ['geoId', 'color', 'opacity', 'text', 'details'])
      for (const f of e[ch] ?? []) if (f.analyticType === 'dimension' && !dims.includes(f.fid)) dims.push(f.fid);
    const groups = new Map<string, number[]>();
    for (const r of rows) {
      if (!tests.every((t) => t(r))) continue;
      const x = num(r);
      if (!Number.isFinite(x)) continue;
      const k = dims.map((d) => String(r[d])).join('\u0001');
      const g = groups.get(k);
      if (g) g.push(x); else groups.set(k, [x]);
    }
    for (const g of groups.values()) {
      if (agg === 'count') take(g.length);
      else if (agg === 'min') take(Math.min(...g));
      else if (agg === 'max') take(Math.max(...g));
      else if (agg === 'median') { g.sort((a, b) => a - b); take(g.length % 2 ? g[(g.length - 1) / 2] : (g[g.length / 2 - 1] + g[g.length / 2]) / 2); }
      else { let s = 0; for (const x of g) s += x; take(agg === 'mean' ? s / g.length : s); }
    }
  }
  return max >= min ? { min, max } : null;
}
