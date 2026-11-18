import assert from 'node:assert/strict';
import { colorOf, distinctValues, makeColorScale, mapExtent, quantScale, rampAt, resolveQuant, sampleColors, RAMPS } from '../src/colorScale.ts';

const rows = [{ c: 'b' }, { c: 'a' }, { c: 'b' }, { c: null }, { c: 'c' }];
assert.deepEqual(distinctValues(rows, 'c'), ['a', 'b', 'c']);
assert.equal(rampAt(['#000000', '#ffffff'], 0.5), '#808080');

// 類別：逐值指定
const Q = { palette: '紅色', steps: 0, reverse: false };
const fn = makeColorScale({ maps: { c: { b: '#ff0000' }, other: { zzz: '#00ff00' } }, cat: ['#111111', '#222222'], quant: Q });
assert.deepEqual(fn({ semanticType: 'nominal', theme: 'light', values: ['b', 'a', 'c', 'a'] }), { domain: ['a', 'b', 'c'], range: ['#111111', '#ff0000', '#111111'] });
assert.deepEqual(fn({ semanticType: 'nominal', theme: 'light', values: ['x', 'y'] }), {});
assert.deepEqual(makeColorScale({ maps: {}, cat: ['#111'], quant: Q })({ semanticType: 'nominal', theme: 'light', values: ['x'] }), {});

// 數值：連續
let seen: unknown = null;
const qf = makeColorScale({ maps: {}, cat: [], quant: Q, onExtent: (e) => { seen = e; } });
const s1 = qf({ semanticType: 'quantitative', theme: 'light', values: [10, '', null, 50, 30] }) as { domain: number[]; range: string[]; clamp: boolean };
assert.deepEqual(seen, { min: 10, max: 50 });
assert.deepEqual(s1.domain, [10, 20, 30, 40, 50]);
assert.deepEqual(s1.range, RAMPS['紅色']);
assert.equal(s1.clamp, true);
assert.deepEqual(qf({ semanticType: 'quantitative', theme: 'light', values: [5, 5] }), {});
assert.deepEqual(qf({ semanticType: 'temporal', theme: 'light', values: [1, 2] }), {});

// 分步＋反向＋自訂開始／結束
const st = quantScale({ palette: '紅色', steps: 2, reverse: true, start: 0, end: 100 }, { min: -5, max: 500 }) as { type: string; domain: number[]; range: string[] };
assert.equal(st.type, 'threshold');
assert.deepEqual(st.domain, [50]);
assert.deepEqual(st.range, [RAMPS['紅色'][4], RAMPS['紅色'][0]]);

// 自動：有正有負 → 發散、以 0 置中、左右對稱
const r = resolveQuant({ palette: '自動', steps: 0, reverse: false }, { min: -100, max: 300 });
assert.equal(r.name, '橘色—藍色發散'); assert.equal(r.center, 0);
assert.equal(resolveQuant({ palette: '自動', steps: 0, reverse: false }, { min: 0, max: 9 }).name, '藍色');
const D = { palette: '橘色—藍色發散', steps: 0, reverse: false };
assert.equal(colorOf(D, { min: -100, max: 300 }, 0), '#f7f7f7');
assert.equal(colorOf(D, { min: -100, max: 300 }, 300), '#1f78b4');
assert.notEqual(colorOf(D, { min: -100, max: 300 }, -100), '#d95f02'); // 對稱：-100 只到 1/3 深
assert.equal(colorOf({ ...D, full: true }, { min: -100, max: 300 }, -100), '#d95f02');

// 地圖色階：等距鋪在資料範圍上
const m = sampleColors({ palette: '紅色', steps: 5, reverse: false }, { min: 0, max: 100 }, 256);
assert.equal(m.length, 256); assert.equal(m[0], RAMPS['紅色'][0]); assert.equal(m[255], RAMPS['紅色'][4]);
assert.equal(new Set(m).size, 5);
assert.equal(sampleColors({ palette: '紅色', steps: 0, reverse: false, end: 50 }, { min: 0, max: 100 }, 256)[128], RAMPS['紅色'][4]);

// 地圖數值範圍
const data = [{ k: 'US', s: 100, y: 1 }, { k: 'TW', s: 30, y: 1 }, { k: 'US', s: 50, y: 2 }, { k: 'JP', s: 60, y: 2 }, { k: 'TW', s: null, y: 2 }];
const col = [{ fid: 's', analyticType: 'measure', aggName: 'sum' }], geo = [{ fid: 'k', analyticType: 'dimension' }];
assert.deepEqual(mapExtent({ c: 'geographic', a: true, e: { geoId: geo, color: col } }, data), { min: 30, max: 150 });
assert.deepEqual(mapExtent({ c: 'geographic', a: false, e: { geoId: geo, color: col } }, data), { min: 30, max: 100 });
assert.deepEqual(mapExtent({ a: true, e: { geoId: geo, color: [{ ...col[0], aggName: 'mean' }] } }, data), { min: 30, max: 75 });
assert.deepEqual(mapExtent({ a: true, e: { geoId: geo, color: col, filters: [{ fid: 'y', rule: { type: 'one of', value: [2] } }] } }, data), { min: 50, max: 60 });
assert.deepEqual(mapExtent({ a: true, e: { geoId: geo, color: [{ fid: 'gw_count_fid', analyticType: 'measure', aggName: 'sum' }] } }, data), { min: 1, max: 2 });
assert.equal(mapExtent({ a: true, e: { geoId: geo, color: [{ ...col[0], aggName: 'variance' }] } }, data), null);
assert.equal(mapExtent({ a: true, e: { geoId: geo, color: geo } }, data), null);
console.log('colorScale ALL PASS');
