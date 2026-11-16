// jute-market-bd -- headless-Chrome smoke test via raw CDP (no puppeteer).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9366;
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/jmb-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const nav = async (url) => { await send('Page.navigate', { url }); await wait(1200); };
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const clickTab = async (name) => ev(`document.querySelector('[data-tab="${name}"]').click()`);
  const setVal = async (id, v) => ev(
    `var el=document.getElementById('${id}'); el.value=${JSON.stringify(v)}; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}))`);
  const stored = async () => JSON.parse(await ev(`localStorage.getItem('jute-market-bd-v1')`) || '{}');
  const dstr = (offset) => {
    const d = new Date(Date.now() + offset * 86400000);
    return d.toISOString().slice(0, 10);
  };
  const sowing = dstr(-120);   // expected harvest = today - 5 (overdue)
  const harvestDate = dstr(-5);
  const todayStr = dstr(0);

  // ---- Load: empty state ----
  await nav(BASE);
  check('page title mentions Jute Market', (await ev('document.title'))?.includes('Jute Market'));
  check('3 tabs present', (await ev(`document.querySelectorAll('[data-tab]').length`)) === 3);
  check('dashboard visible on load', (await ev(`document.getElementById('tab-dashboard').hidden`)) === false);
  check('empty: 0 plots', (await ev(`document.getElementById('statPlots').textContent`)) === '0');
  check('empty: 0 fibre', (await ev(`document.getElementById('statFibre').textContent`)) === '0');
  check('empty: net profit \u09f30', (await ev(`document.getElementById('statProfit').textContent`)) === '\u09f30');
  check('empty: due-empty message shown', (await ev(`document.getElementById('dueEmpty').hidden`)) === false);
  check('empty: plots empty state shown', (await ev(`document.getElementById('plotsEmpty').hidden`)) === false);
  check('empty: chart empty state shown', (await ev(`document.getElementById('chartEmpty').hidden`)) === false);
  check('lang button shows Bangla label', (await ev(`document.getElementById('langBtn').textContent`)) === '\u09ac\u09be\u0982\u09b2\u09be');
  check('asof note hidden without ?asof=', (await ev(`document.getElementById('asofNote').hidden`)) === true);

  // ---- ?asof= override ----
  await nav(BASE + '?asof=2026-11-16');
  check('?asof= shows as-of note', (await ev(`document.getElementById('asofNote').hidden`)) === false);
  check('?asof= note names the date', (await ev(`document.getElementById('asofNote').textContent`)).includes('2026-11-16'));
  await nav(BASE);

  // ---- Plots: validation, then add (1 bigha = 33 decimals) ----
  await clickTab('plots');
  await ev(`document.getElementById('plotForm').dispatchEvent(new Event('submit',{cancelable:true}))`);
  check('empty plot name shows error', (await ev(`document.getElementById('plotError').textContent`)).length > 0);
  await setVal('plotName', 'North Field');
  await setVal('plotArea', '1');
  await setVal('plotAreaUnit', 'bigha');
  await setVal('plotVariety', 'Tossa');
  await setVal('plotSowing', sowing);
  await ev(`document.getElementById('plotForm').dispatchEvent(new Event('submit',{cancelable:true}))`);
  check('plot saved to localStorage', (await stored()).plots.length === 1);
  check('1 bigha stored as 33 decimals', (await stored()).plots[0].areaDecimals === 33);
  check('dashboard shows 1 plot', (await ev(`document.getElementById('statPlots').textContent`)) === '1');
  check('dashboard shows total area 33', (await ev(`document.getElementById('statArea').textContent`)) === '33');
  check('due list flags harvest overdue', (await ev(`document.getElementById('dueList').textContent`)).includes('overdue'));
  check('plot row shows Harvest due badge', (await ev(`document.getElementById('dashPlotList').textContent`)).includes('Harvest due'));

  // ---- Edit plot name ----
  await clickTab('plots');
  await ev(`document.querySelector('[data-edit]').click()`);
  check('edit pre-fills name', (await ev(`document.getElementById('plotName').value`)) === 'North Field');
  await setVal('plotName', 'North Field 2');
  await ev(`document.getElementById('plotForm').dispatchEvent(new Event('submit',{cancelable:true}))`);
  check('edit renames plot', (await stored()).plots[0].name === 'North Field 2');

  // ---- Detail: timeline + harvest ----
  await ev(`document.querySelector('[data-view]').click()`);
  check('detail view shown', (await ev(`document.getElementById('plotDetailWrap').hidden`)) === false);
  check('timeline shows expected harvest date', (await ev(`document.getElementById('timeline').textContent`)).includes(dstr(-5)));
  check('timeline labels typical range', (await ev(`document.getElementById('timeline').textContent`)).includes('110'));
  await ev(`document.getElementById('harvestForm').dispatchEvent(new Event('submit',{cancelable:true}))`);
  check('empty harvest date shows error', (await ev(`document.getElementById('harvError').textContent`)).length > 0);
  await setVal('harvDate', harvestDate);
  await setVal('harvGreen', '1000');
  await setVal('harvFibre', '120');
  await ev(`document.getElementById('harvestForm').dispatchEvent(new Event('submit',{cancelable:true}))`);
  check('harvest saved', (await stored()).plots[0].harvests.length === 1);
  check('harvest stats show 120 kg fibre', (await ev(`document.getElementById('harvestStats').textContent`)).includes('120'));
  check('yield per decimal is 3.64', (await ev(`document.getElementById('harvestStats').textContent`)).includes('3.64'));
  check('status now Harvested', (await ev(`document.getElementById('detailSummary').textContent`)).includes('Harvested'));

  // ---- Sale: qty x price total, profit math ----
  await setVal('saleBuyer', 'Karim');
  await setVal('saleDate', todayStr);
  await setVal('saleQty', '100');
  await setVal('salePrice', '55');
  await ev(`document.getElementById('saleForm').dispatchEvent(new Event('submit',{cancelable:true}))`);
  check('sale saved', (await stored()).plots[0].sales.length === 1);
  check('sale row shows total 5,500', (await ev(`document.getElementById('saleList').textContent`)).includes('5,500'));
  await setVal('saleBuyer', 'Rahim');
  await setVal('saleDate', todayStr);
  await setVal('saleQty', '50');
  await setVal('salePrice', '60');
  await ev(`document.getElementById('saleForm').dispatchEvent(new Event('submit',{cancelable:true}))`);
  check('sale over unsold stock blocked', (await ev(`document.getElementById('saleError').textContent`)).length > 0);
  check('still 1 sale stored', (await stored()).plots[0].sales.length === 1);

  // ---- Expense ----
  await setVal('expCategory', 'Seed');
  await setVal('expDate', todayStr);
  await setVal('expAmount', '2000');
  await ev(`document.getElementById('expenseForm').dispatchEvent(new Event('submit',{cancelable:true}))`);
  check('expense saved', (await stored()).plots[0].expenses.length === 1);
  check('plot profit is 3,500', (await ev(`document.getElementById('profitBox').textContent`)).includes('3,500'));

  // ---- Dashboard totals + chart ----
  await clickTab('dashboard');
  check('dashboard fibre is 120', (await ev(`document.getElementById('statFibre').textContent`)) === '120');
  check('dashboard sales income is 5,500', (await ev(`document.getElementById('statSales').textContent`)).includes('5,500'));
  check('dashboard expenses are 2,000', (await ev(`document.getElementById('statExpenses').textContent`)).includes('2,000'));
  check('dashboard net profit is 3,500', (await ev(`document.getElementById('statProfit').textContent`)).includes('3,500'));
  check('chart has 1 bar', (await ev(`document.querySelectorAll('#chart .bar-col').length`)) === 1);
  check('chart empty state hidden', (await ev(`document.getElementById('chartEmpty').hidden`)) === true);
  check('due list now clear (harvested)', (await ev(`document.getElementById('dueEmpty').hidden`)) === false);

  // ---- Language toggle persists + Bengali digits ----
  await clickTab('data');
  await ev(`document.getElementById('langBtn').click()`);
  check('BN toggle: title in Bengali', (await ev(`document.querySelector('.topbar h1').textContent`)) === '\u099c\u09c1\u099f \u09ae\u09be\u09b0\u09cd\u0995\u09c7\u099f \u09ac\u09bf\u09a1\u09bf');
  check('BN toggle: plot count in Bengali digit', (await ev(`document.getElementById('statPlots').textContent`)) === '\u09e7');
  await nav(BASE);
  check('BN toggle persists after reload', (await stored()).lang === 'bn');
  check('plot persists after reload', (await stored()).plots.length === 1);
  await ev(`document.getElementById('langBtn').click()`);
  check('back to EN', (await stored()).lang === 'en');

  // ---- Export show + bad import rejected ----
  await clickTab('data');
  await ev(`document.getElementById('exportShowBtn').click()`);
  check('export fills JSON box', (await ev(`document.getElementById('importBox').value`)).includes('"plots"'));
  check('export JSON names the app', (await ev(`document.getElementById('importBox').value`)).includes('jute-market-bd'));
  await setVal('importBox', '{"app":"gas-cylinder-bd","plots":[]}');
  await ev(`document.getElementById('importBtn').click()`);
  check('wrong-app import rejected', (await ev(`document.getElementById('importMsg').textContent`)).includes('not a valid'));
  check('bad import keeps existing data', (await stored()).plots.length === 1);

  // ---- Typed-DELETE reset ----
  await ev(`window.prompt=function(){return 'DELETE'}; document.getElementById('resetBtn').click()`);
  check('reset clears plots', (await stored()).plots.length === 0);
  check('reset shows 0 plots on dashboard', (await ev(`document.getElementById('statPlots').textContent`)) === '0');

  // ---- Footer ----
  check('footer mentions localStorage', (await ev(`document.querySelector('footer').textContent`)).includes('localStorage'));
  check('footer disclaims market prices', (await ev(`document.querySelector('footer').textContent`)).includes('not market quotes'));

  // ---- Mobile 390px: no horizontal overflow on any tab ----
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav(BASE);
  for (const tab of ['dashboard', 'plots', 'data']) {
    await clickTab(tab);
    await wait(300);
    const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check('390px no overflow on ' + tab + ' tab', overflow <= 0, 'overflow=' + overflow);
  }

  // ---- Zero network requests: app is fully offline (only file:// loads) ----
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); process.exit(2); });
