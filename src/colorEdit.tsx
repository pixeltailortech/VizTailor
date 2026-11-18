import { useEffect, useRef, useState } from 'react';
import { DEFAULT_QUANT, PALETTES, RAMPS, rampAt, resolveQuant, sampleColors, type ColorMaps, type Extent, type QuantCfg, type Val } from './colorScale';
import { DEFAULT_STYLE, type VizStyle } from './palette';

/**
 * 「編輯色彩」對話框，照 Tableau 的做法，改了立刻套用：
 * - 「顏色」是數值（度量）→ 調色盤、開始／置中／結束、分步色彩、反向（圖表與地圖都適用）。
 * - 「顏色」是類別（維度）→ 左邊選資料項、右邊選調色盤點色塊指派，或「指派調色盤」。
 */
function loadJson<T>(key: string, fb: T): T {
  try {
    const s = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (s && typeof s === 'object') return s as T;
  } catch { /* 儲存被封鎖：不記住也無妨 */ }
  return fb;
}
function saveJson(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* 同上 */ }
}
export type QuantMap = Record<string, QuantCfg>; // 欄位 fid → 數值色彩設定
export const loadColorMaps = () => loadJson<ColorMaps>('viztailor.colormap.v1', {});
export const saveColorMaps = (m: ColorMaps) => saveJson('viztailor.colormap.v1', m);
export const loadQuantMap = () => loadJson<QuantMap>('viztailor.quant.v1', {});
export const saveQuantMap = (m: QuantMap) => saveJson('viztailor.quant.v1', m);

/** 目前放在「顏色」的欄位 */
export type ColorField =
  | { kind: 'none' }
  | { kind: 'measure'; fid: string; label: string; extent: Extent | null }
  | { kind: 'dimension'; fid: string; name: string; values: Val[]; onMap: boolean };

const AGG: Record<string, string> = { sum: '總和', mean: '平均', count: '計數', min: '最小值', max: '最大值', median: '中位數' };
export const measureLabel = (name: string, agg?: string) => (agg && AGG[agg] ? `${AGG[agg]}(${name})` : name);

const fmt = (x: number) => x.toLocaleString(undefined, { maximumFractionDigits: Math.abs(x) >= 100 ? 0 : 3 });
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
const gradient = (stops: string[]) => `linear-gradient(to right, ${stops.join(',')})`;

/** 調色盤下拉（每個選項前面有色帶縮圖，原生 select 做不到） */
function RampSelect({ value, shown, onChange }: { value: string; shown: string; onChange: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const chip = (name: string) => <span className="cx-chip" style={{ background: gradient(RAMPS[name] ?? RAMPS[shown]) }} />;
  return (
    <div className="cx-dd" ref={box}>
      <button type="button" className="cx-dd-btn" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        {chip(value)}<span>{value}</span><span className="cx-caret">▾</span>
      </button>
      {open && (
        <div className="cx-dd-list" role="listbox">
          {['自動', ...Object.keys(RAMPS)].map((k) => (
            <div key={k} role="option" aria-selected={k === value} className={`cx-dd-opt${k === value ? ' on' : ''}`} onClick={() => { onChange(k); setOpen(false); }}>
              {chip(k)}<span>{k}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 開始／置中／結束：自動 或 自訂數值（按 Enter 或離開欄位才套用） */
function Bound({ label, auto, value, disabled, onChange }: { label: string; auto: number | null; value: number | undefined; disabled?: boolean; onChange: (v: number | undefined) => void }) {
  const custom = value !== undefined;
  const cur = custom ? value : auto;
  const [text, setText] = useState(cur == null ? '' : String(cur));
  useEffect(() => setText(cur == null ? '' : String(cur)), [cur]);
  const commit = () => {
    const x = Number(text);
    if (text.trim() !== '' && Number.isFinite(x)) onChange(x); else setText(cur == null ? '' : String(cur));
  };
  return (
    <div className={`cx-bound${disabled ? ' off' : ''}`}>
      <div className="cx-lab">{label}</div>
      <div className="cx-row">
        <select disabled={disabled} value={custom ? 'c' : 'a'} onChange={(e) => onChange(e.target.value === 'c' ? (auto ?? 0) : undefined)}>
          <option value="a">自動</option><option value="c">自訂</option>
        </select>
        <input type="text" inputMode="decimal" disabled={disabled || !custom} value={custom ? text : cur == null ? '' : fmt(cur)}
          onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
      </div>
    </div>
  );
}

function ColorPick({ value, onCommit }: { value: string; onCommit: (c: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    if (v === value) return;
    const t = setTimeout(() => onCommit(v), 200); // 拖曳色盤時不斷觸發，停手才套用
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return <input type="color" className="cx-pick" value={v} onChange={(e) => setV(e.target.value)} />;
}

function Measure({ field, cfg, setCfg }: { field: Extract<ColorField, { kind: 'measure' }>; cfg: QuantCfg; setCfg: (c: QuantCfg) => void }) {
  const ext = field.extent;
  const r = resolveQuant(cfg, ext);
  const set = (p: Partial<QuantCfg>) => setCfg({ ...cfg, ...p });
  const [lastSteps, setLastSteps] = useState(cfg.steps >= 2 ? cfg.steps : 5);
  const stepped = cfg.steps >= 2;
  const bar = sampleColors(cfg, ext, 96, 'range');
  const autoR = resolveQuant({ ...cfg, start: undefined, end: undefined, center: undefined }, ext);
  return (
    <>
      <div className="cx-lab">調色盤</div>
      <RampSelect value={RAMPS[cfg.palette] ? cfg.palette : '自動'} shown={r.name} onChange={(palette) => set({ palette })} />
      <div className="cx-bar">{bar.map((c, i) => <span key={i} style={{ background: c }} />)}</div>
      <div className="cx-ends">
        {ext || cfg.start !== undefined ? <span>{fmt(r.start)}</span> : <span>低</span>}
        {ext || cfg.end !== undefined ? <span>{fmt(r.end)}</span> : <span>高</span>}
      </div>
      {!ext && <div className="cx-note">這張圖目前取不到數值範圍，「開始／結束」請維持自動。</div>}
      <Bound label="開始" auto={ext ? autoR.start : null} value={cfg.start} disabled={!ext} onChange={(start) => set({ start })} />
      <Bound label="置中" auto={r.div && ext ? autoR.center : null} value={r.div ? cfg.center : undefined} disabled={!ext || !r.div} onChange={(center) => set({ center })} />
      <Bound label="結束" auto={ext ? autoR.end : null} value={cfg.end} disabled={!ext} onChange={(end) => set({ end })} />
      <div className="cx-row cx-opt">
        <label className="cx-chk"><input type="checkbox" checked={stepped} onChange={(e) => set({ steps: e.target.checked ? lastSteps : 0 })} />分步色彩</label>
        <input type="number" min={2} max={20} disabled={!stepped} value={stepped ? cfg.steps : lastSteps}
          onChange={(e) => { const n = Math.min(20, Math.max(2, Math.round(Number(e.target.value) || 2))); setLastSteps(n); set({ steps: n }); }} />
        <span className={stepped ? '' : 'cx-dim'}>步驟</span>
      </div>
      <label className="cx-chk cx-opt"><input type="checkbox" checked={cfg.reverse} onChange={(e) => set({ reverse: e.target.checked })} />反向</label>
      <label className={`cx-chk cx-opt${r.div ? '' : ' cx-dim'}`}><input type="checkbox" disabled={!r.div} checked={!!cfg.full && r.div} onChange={(e) => set({ full: e.target.checked })} />使用完整色彩範圍</label>
      <button className="cx-reset" onClick={() => setCfg(DEFAULT_QUANT)}>↺ 重設</button>
    </>
  );
}

function Dimension({ field, map, setMap, style, setStyle }: {
  field: Extract<ColorField, { kind: 'dimension' }>;
  map: Record<string, string>; setMap: (m: Record<string, string>) => void;
  style: VizStyle; setStyle: (s: VizStyle) => void;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [pal, setPal] = useState(Object.keys(PALETTES).find((k) => same(PALETTES[k], style.cat)) ?? 'Tableau 10');
  const [q, setQ] = useState('');
  const k = q.trim().toLowerCase();
  const items = field.values
    .map((v, i) => ({ v: String(v), color: map[String(v)] ?? style.cat[i % style.cat.length] }))
    .filter((x) => !k || x.v.toLowerCase().includes(k))
    .slice(0, 500);

  const click = (v: string, e: React.MouseEvent) => {
    const next = new Set(e.ctrlKey || e.metaKey ? sel : []);
    if (e.shiftKey && anchor) {
      const names = items.map((x) => x.v);
      const a = names.indexOf(anchor), b = names.indexOf(v);
      if (a >= 0 && b >= 0) for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(names[i]);
    } else if ((e.ctrlKey || e.metaKey) && sel.has(v)) next.delete(v);
    else next.add(v);
    if (!e.shiftKey) setAnchor(v);
    setSel(next);
  };
  const assign = (c: string) => {
    if (sel.size === 0) return;
    const n = { ...map };
    sel.forEach((v) => { n[v] = c; });
    setMap(n);
  };
  return (
    <>
      <div className="cx-two">
        <div className="cx-col">
          <div className="cx-lab">選取資料項：</div>
          {field.values.length > 12 && <input className="cx-search" placeholder="搜尋…" value={q} onChange={(e) => setQ(e.target.value)} />}
          <div className="cx-list">
            {items.map((x) => (
              <div key={x.v} className={`cx-item${sel.has(x.v) ? ' on' : ''}`} onClick={(e) => click(x.v, e)}>
                <span className="cx-swatch" style={{ background: x.color }} /><span className="cx-name">{x.v}</span>
              </div>
            ))}
            {field.values.length > 500 && <div className="cx-note">最多顯示 500 項，請用搜尋縮小範圍。</div>}
          </div>
        </div>
        <div className="cx-col">
          <div className="cx-lab">選取調色盤：</div>
          <select value={pal} onChange={(e) => setPal(e.target.value)}>
            {Object.keys(PALETTES).map((p) => <option key={p}>{p}</option>)}
          </select>
          <div className="cx-grid">
            {PALETTES[pal].map((c, i) => <button key={i} className="cx-cell" style={{ background: c }} title={c} onClick={() => assign(c)} />)}
          </div>
          <button onClick={() => { setStyle({ ...style, cat: PALETTES[pal] }); setMap({}); setSel(new Set()); }}>指派調色盤</button>
        </div>
      </div>
      <div className="cx-note">
        先點左邊的資料項（Ctrl／Shift 可多選），再點右邊的色塊；「指派調色盤」會把整組顏色依序套給全部資料項。
        {field.onMap && ' 地圖上的類別只會套用「指派調色盤」的整組顏色，個別指定的顏色只對一般圖表有效。'}
      </div>
      <button className="cx-reset" onClick={() => { setStyle({ ...style, cat: DEFAULT_STYLE.cat }); setMap({}); setSel(new Set()); }}>↺ 重設</button>
    </>
  );
}

type Props = {
  field: ColorField;
  onClose: () => void;
  style: VizStyle; setStyle: (s: VizStyle) => void;
  maps: ColorMaps; setMaps: (m: ColorMaps) => void;
  quants: QuantMap; setQuants: (m: QuantMap) => void;
};

export function ColorEditor({ field, onClose, style, setStyle, maps, setMaps, quants, setQuants }: Props) {
  const set = (p: Partial<VizStyle>) => setStyle({ ...style, ...p });
  const title = field.kind === 'measure' ? ` ${field.label}` : field.kind === 'dimension' ? ` [${field.name}]` : '';
  return (
    <div className="cx-back" onMouseDown={onClose}>
      <div className={`cx${field.kind === 'dimension' ? ' wide' : ''}`} role="dialog" aria-label="編輯色彩" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cx-head">
          <h3>編輯色彩{title}</h3>
          <button className="geo-close" onClick={onClose} aria-label="關閉">×</button>
        </div>
        <div className="cx-body">
          {field.kind === 'none' && (
            <div className="cx-hint">
              目前沒有欄位放在「顏色」。<br />
              把數值欄位（如 Profit、Sales）拖到「顏色」→ 依數值深淺上色（圖表與地圖都可以），再回來這裡換調色盤。<br />
              把類別欄位（如 Category）拖到「顏色」→ 每個類別一種顏色。
            </div>
          )}
          {field.kind === 'measure' && (
            <Measure field={field} cfg={quants[field.fid] ?? DEFAULT_QUANT}
              setCfg={(c) => setQuants({ ...quants, [field.fid]: c })} />
          )}
          {field.kind === 'dimension' && (
            <Dimension field={field} map={maps[field.fid] ?? {}} style={style} setStyle={setStyle}
              setMap={(m) => { const n = { ...maps }; if (Object.keys(m).length) n[field.fid] = m; else delete n[field.fid]; setMaps(n); }} />
          )}
          <details className="cx-more">
            <summary>其他：單色與標記大小</summary>
            <div className="cx-row"><span>沒有放「顏色」時的單色</span><ColorPick value={style.primary} onCommit={(c) => set({ primary: c })} /></div>
            <div className="cx-row">
              <span>「大小」欄位的標記面積</span>
              <input type="number" min={1} step={10} value={style.sizeMin} onChange={(e) => set({ sizeMin: Math.max(1, Number(e.target.value) || 1) })} />
              <span>～</span>
              <input type="number" min={1} step={50} value={style.sizeMax} onChange={(e) => set({ sizeMax: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
export { rampAt };
