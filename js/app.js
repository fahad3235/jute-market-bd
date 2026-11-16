'use strict';
/* jute-market-bd -- UI. Requires js/logic.js (JuteLogic), js/i18n.js (JUTE_STRINGS), js/data.js (JUTE_emptyState). */
var KEY = 'jute-market-bd-v1';

var ASOF = (function () {
  try {
    var q = new URLSearchParams(window.location.search).get('asof');
    return JuteLogic.isValidDateStr(q) ? q : null;
  } catch (e) { return null; }
})();
function getToday() { return ASOF || JuteLogic.todayLocal(); }

var state = load();
var selectedPlotId = null;
var editingPlotId = null;

function load() {
  try {
    var raw = localStorage.getItem(KEY);
    if (!raw) return JUTE_emptyState();
    var s = JSON.parse(raw);
    if (!s || s.app !== 'jute-market-bd' || !Array.isArray(s.plots)) return JUTE_emptyState();
    s.lang = s.lang === 'bn' ? 'bn' : 'en';
    return s;
  } catch (e) { return JUTE_emptyState(); }
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

function t(key, vars) {
  var s = (JUTE_STRINGS[state.lang] && JUTE_STRINGS[state.lang][key]) || JUTE_STRINGS.en[key] || key;
  if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
  return s;
}
function num(n, dec) {
  var s = JuteLogic.fmt(n, dec);
  return state.lang === 'bn' ? JuteLogic.toBnDigits(s) : s;
}
function dateStr(s) { return state.lang === 'bn' ? JuteLogic.toBnDigits(s) : s; }
function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function $(id) { return document.getElementById(id); }
function uid() { return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
function findPlot(id) {
  for (var i = 0; i < state.plots.length; i++) if (state.plots[i].id === id) return state.plots[i];
  return null;
}
function statusBadge(st) {
  return '<span class="badge ' + st + '">' + esc(t('status' + st.charAt(0).toUpperCase() + st.slice(1))) + '</span>';
}
function kv(label, value) {
  return '<div><span>' + esc(label) + '</span><b>' + value + '</b></div>';
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
  document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
  $('langBtn').textContent = state.lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
  $('plotSubmitBtn').textContent = editingPlotId ? t('updatePlot') : t('addPlot');
  $('plotFormTitle').textContent = editingPlotId ? t('updatePlot') : t('addPlot');
  $('plotCancelBtn').hidden = !editingPlotId;
}

function plotRow(p, today) {
  var st = JuteLogic.plotStatus(p, today);
  var exp = JuteLogic.expectedHarvestDate(p);
  return '<div class="plot-row"><div><strong>' + esc(p.name) + '</strong>' + statusBadge(st)
    + '<div class="meta">' + esc(p.variety) + ' \u00b7 ' + num(p.areaDecimals) + ' ' + esc(t('decimals'))
    + ' (' + num(JuteLogic.decimalsToBigha(p.areaDecimals), 2) + ' ' + esc(t('bigha').split(' (')[0]) + ')'
    + ' \u00b7 ' + esc(t('sownLbl')) + ' ' + dateStr(p.sowingDate)
    + ' \u00b7 ' + esc(t('tlHarvest')) + ' ' + dateStr(exp)
    + ' \u00b7 ' + num(JuteLogic.totalFibre(p)) + ' ' + esc(t('kg')) + '</div></div>'
    + '<div class="actions"><button type="button" class="btn small" data-view="' + p.id + '">' + esc(t('viewBtn')) + '</button> '
    + '<button type="button" class="btn small" data-edit="' + p.id + '">' + esc(t('editBtn')) + '</button> '
    + '<button type="button" class="btn small" data-del-plot="' + p.id + '">' + esc(t('deleteBtn')) + '</button></div></div>';
}

function render() {
  applyI18n();
  var today = getToday();
  var totals = JuteLogic.dashboardTotals(state.plots);
  var due = JuteLogic.dueItems(state.plots, today);

  // --- asof note ---
  var asofEl = $('asofNote');
  if (ASOF) { asofEl.hidden = false; asofEl.textContent = t('asofNote', { date: dateStr(ASOF) }); }
  else { asofEl.hidden = true; asofEl.textContent = ''; }

  // --- Due list ---
  var dueHtml = '';
  due.harvestOverdue.forEach(function (d) {
    dueHtml += '<div class="due-item overdue">' + esc(t('harvestOverdue', { n: num(d.daysOverdue), name: d.name, date: dateStr(d.date) })) + '</div>';
  });
  due.rettingOverdue.forEach(function (d) {
    dueHtml += '<div class="due-item overdue">' + esc(t('rettingOverdue', { n: num(d.daysOverdue), name: d.name, date: dateStr(d.date) })) + '</div>';
  });
  due.harvestSoon.forEach(function (d) {
    dueHtml += '<div class="due-item soon">' + esc(t('harvestSoon', { n: num(d.daysLeft), name: d.name, date: dateStr(d.date) })) + '</div>';
  });
  due.rettingSoon.forEach(function (d) {
    dueHtml += '<div class="due-item soon">' + esc(t('rettingSoon', { n: num(d.daysLeft), name: d.name, date: dateStr(d.date) })) + '</div>';
  });
  $('dueList').innerHTML = dueHtml;
  $('dueEmpty').hidden = dueHtml.length > 0;

  // --- Stats ---
  $('statPlots').textContent = num(totals.plots);
  $('statArea').textContent = num(totals.totalArea);
  $('statFibre').textContent = num(totals.totalFibre);
  $('statSales').textContent = '\u09f3' + num(totals.totalSales);
  $('statExpenses').textContent = '\u09f3' + num(totals.totalExpenses);
  var profitEl = $('statProfit');
  profitEl.textContent = '\u09f3' + num(totals.netProfit);
  profitEl.classList.toggle('negative', totals.netProfit < 0);

  // --- Chart: fibre kg per plot ---
  var chart = $('chart');
  var withFibre = state.plots.filter(function (p) { return JuteLogic.totalFibre(p) > 0; });
  $('chartEmpty').hidden = withFibre.length > 0;
  if (withFibre.length) {
    var maxF = Math.max.apply(null, withFibre.map(function (p) { return JuteLogic.totalFibre(p); }));
    chart.innerHTML = withFibre.map(function (p) {
      var f = JuteLogic.totalFibre(p);
      var h = maxF ? Math.round((f / maxF) * 120) : 0;
      return '<div class="bar-col"><span class="bar-val">' + num(f) + '</span><div class="bar" style="height:' + h + 'px"></div><span class="bar-lbl">' + esc(p.name) + '</span></div>';
    }).join('');
  } else { chart.innerHTML = ''; }

  // --- Plot lists (dashboard + plots tab) ---
  var rows = state.plots.map(function (p) { return plotRow(p, today); }).join('');
  $('dashPlotList').innerHTML = rows;
  $('dashPlotsEmpty').hidden = state.plots.length > 0;
  $('plotList').innerHTML = rows;
  $('plotsEmpty').hidden = state.plots.length > 0;

  // --- Detail view ---
  var detail = selectedPlotId ? findPlot(selectedPlotId) : null;
  $('plotListWrap').hidden = !!detail;
  $('plotDetailWrap').hidden = !detail;
  if (detail) renderDetail(detail, today);
}
function renderDetail(p, today) {
  var st = JuteLogic.plotStatus(p, today);
  var exp = JuteLogic.expectedHarvestDate(p);
  var w = JuteLogic.rettingWindow(p);
  var ypd = JuteLogic.yieldPerDecimal(p);
  $('detailTitle').textContent = p.name + ' ';
  $('detailSummary').innerHTML =
    kv(t('varietyLbl'), esc(p.variety))
    + kv(t('areaLbl'), num(p.areaDecimals) + ' ' + esc(t('decimals')) + ' (' + num(JuteLogic.decimalsToBigha(p.areaDecimals), 2) + ' ' + esc(t('bigha').split(' (')[0]) + ')')
    + kv(t('sownLbl'), dateStr(p.sowingDate))
    + kv(t('tlHarvest'), dateStr(exp))
    + kv(t('status'), statusBadge(st))
    + kv(t('totalFibreLbl'), num(JuteLogic.totalFibre(p)) + ' ' + esc(t('kg')))
    + kv(t('yieldPerDecimal'), ypd === null ? '\u2014' : num(ypd, 2) + ' ' + esc(t('perDecimal')))
    + kv(t('unsold'), num(JuteLogic.unsoldFibre(p)) + ' ' + esc(t('kg')));

  // Timeline
  var h = JuteLogic.latestHarvest(p);
  var step = function (cls, title, date, note) {
    return '<div class="tl-step ' + cls + '"><span class="tl-dot"></span><div><b>' + esc(title) + '</b>'
      + '<span class="tl-date">' + date + '</span>' + (note ? '<div class="tl-note">' + esc(note) + '</div>' : '') + '</div></div>';
  };
  var tl = step('done', t('tlSowing'), dateStr(p.sowingDate), '');
  var harvestCls = h ? 'done' : (JuteLogic.daysBetween(today, exp) < 0 ? 'now' : '');
  tl += step(harvestCls, t('tlHarvest'), dateStr(exp), t('tlHarvestNote'));
  if (w) {
    var rettingCls = today > w.end ? 'done' : (today >= w.start ? 'now' : '');
    tl += step(rettingCls, t('tlRetting'), dateStr(w.start) + ' \u2192 ' + dateStr(w.end), t('tlRettingNote'));
  } else {
    tl += step('', t('tlRetting'), esc(t('tlNotYet')), t('tlRettingNote'));
  }
  var sold = st === 'sold';
  tl += step(sold ? 'done' : '', t('tlSold'), sold ? num(JuteLogic.totalSoldQty(p)) + ' ' + esc(t('kg')) : esc(t('tlNotYet')), '');
  $('timeline').innerHTML = tl;

  // Harvests
  var harv = p.harvests.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  $('harvestEmpty').hidden = harv.length > 0;
  if (harv.length) {
    $('harvestList').innerHTML = '<table><thead><tr><th>' + esc(t('colDate')) + '</th><th>' + esc(t('colGreen')) + '</th><th>' + esc(t('colFibre')) + '</th><th>' + esc(t('colActions')) + '</th></tr></thead><tbody>'
      + harv.map(function (x) {
        return '<tr><td>' + dateStr(x.date) + '</td><td>' + num(x.greenKg) + '</td><td>' + num(x.fibreKg) + '</td>'
          + '<td><button type="button" class="btn small" data-del-harvest="' + x.id + '">' + esc(t('deleteBtn')) + '</button></td></tr>';
      }).join('') + '</tbody></table>';
  } else { $('harvestList').innerHTML = ''; }
  $('harvestStats').textContent = t('totalFibreLbl') + ': ' + num(JuteLogic.totalFibre(p)) + ' ' + t('kg')
    + ' \u00b7 ' + t('yieldPerDecimal') + ': ' + (ypd === null ? '\u2014' : num(ypd, 2) + ' ' + t('perDecimal'))
    + ' \u00b7 ' + t('unsold') + ': ' + num(JuteLogic.unsoldFibre(p)) + ' ' + t('kg');

  // Sales
  var sales = p.sales.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  $('saleEmpty').hidden = sales.length > 0;
  if (sales.length) {
    $('saleList').innerHTML = '<table><thead><tr><th>' + esc(t('colDate')) + '</th><th>' + esc(t('colBuyer')) + '</th><th>' + esc(t('colQty')) + '</th><th>' + esc(t('colPrice')) + '</th><th>' + esc(t('colTotal')) + '</th><th>' + esc(t('colActions')) + '</th></tr></thead><tbody>'
      + sales.map(function (x) {
        return '<tr><td>' + dateStr(x.date) + '</td><td>' + esc(x.buyer) + '</td><td>' + num(x.qtyKg) + '</td><td>\u09f3' + num(x.pricePerKg) + '</td><td>\u09f3' + num(JuteLogic.saleTotal(x.qtyKg, x.pricePerKg)) + '</td>'
          + '<td><button type="button" class="btn small" data-del-sale="' + x.id + '">' + esc(t('deleteBtn')) + '</button></td></tr>';
      }).join('') + '</tbody></table>';
  } else { $('saleList').innerHTML = ''; }

  // Expenses
  var exps = p.expenses.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  $('expenseEmpty').hidden = exps.length > 0;
  if (exps.length) {
    $('expenseList').innerHTML = '<table><thead><tr><th>' + esc(t('colDate')) + '</th><th>' + esc(t('colCategory')) + '</th><th>' + esc(t('colAmount')) + '</th><th>' + esc(t('colActions')) + '</th></tr></thead><tbody>'
      + exps.map(function (x) {
        return '<tr><td>' + dateStr(x.date) + '</td><td>' + esc(t('cat' + x.category)) + '</td><td>\u09f3' + num(x.amount) + '</td>'
          + '<td><button type="button" class="btn small" data-del-expense="' + x.id + '">' + esc(t('deleteBtn')) + '</button></td></tr>';
      }).join('') + '</tbody></table>';
  } else { $('expenseList').innerHTML = ''; }

  // Profit
  $('profitBox').innerHTML =
    kv(t('salesIncome'), '\u09f3' + num(JuteLogic.totalSales(p)))
    + kv(t('expensesLbl'), '\u09f3' + num(JuteLogic.totalExpenses(p)))
    + kv(t('profitLbl'), '\u09f3' + num(JuteLogic.plotProfit(p)));
}

// --- Tabs ---
document.querySelectorAll('.tab').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    document.querySelectorAll('.tabpage').forEach(function (pg) { pg.hidden = true; });
    $('tab-' + btn.getAttribute('data-tab')).hidden = false;
  });
});

// --- Language ---
$('langBtn').addEventListener('click', function () {
  state.lang = state.lang === 'bn' ? 'en' : 'bn';
  save(); render();
});

// --- Delegated row actions (view / edit / delete) ---
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-view],[data-edit],[data-del-plot],[data-del-harvest],[data-del-sale],[data-del-expense]');
  if (!el) return;
  var p = selectedPlotId ? findPlot(selectedPlotId) : null;
  if (el.hasAttribute('data-view')) {
    selectedPlotId = el.getAttribute('data-view');
    document.querySelector('[data-tab="plots"]').click();
    render();
  } else if (el.hasAttribute('data-edit')) {
    var ep = findPlot(el.getAttribute('data-edit'));
    if (!ep) return;
    editingPlotId = ep.id;
    $('plotName').value = ep.name;
    $('plotVariety').value = ep.variety;
    $('plotArea').value = ep.areaDecimals;
    $('plotAreaUnit').value = 'decimals';
    $('plotSowing').value = ep.sowingDate;
    $('plotError').textContent = '';
    selectedPlotId = null;
    document.querySelector('[data-tab="plots"]').click();
    render();
    $('plotName').focus();
  } else if (el.hasAttribute('data-del-plot')) {
    if (!window.confirm(t('deleteConfirm'))) return;
    state.plots = state.plots.filter(function (x) { return x.id !== el.getAttribute('data-del-plot'); });
    if (selectedPlotId === el.getAttribute('data-del-plot')) selectedPlotId = null;
    save(); render();
  } else if (el.hasAttribute('data-del-harvest') && p) {
    p.harvests = p.harvests.filter(function (x) { return x.id !== el.getAttribute('data-del-harvest'); });
    save(); render();
  } else if (el.hasAttribute('data-del-sale') && p) {
    p.sales = p.sales.filter(function (x) { return x.id !== el.getAttribute('data-del-sale'); });
    save(); render();
  } else if (el.hasAttribute('data-del-expense') && p) {
    p.expenses = p.expenses.filter(function (x) { return x.id !== el.getAttribute('data-del-expense'); });
    save(); render();
  }
});

$('backBtn').addEventListener('click', function () {
  selectedPlotId = null; render();
});

// --- Add / edit plot ---
$('plotForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var today = getToday();
  var areaVal = +$('plotArea').value;
  var areaDecimals = $('plotAreaUnit').value === 'bigha' ? JuteLogic.bighaToDecimals(areaVal) : areaVal;
  var input = {
    name: $('plotName').value.trim(),
    areaDecimals: areaDecimals,
    variety: $('plotVariety').value,
    sowingDate: $('plotSowing').value
  };
  var errors = JuteLogic.validatePlot(input, today);
  var msgMap = { name: 'errName', area: 'errArea', variety: 'errVariety', sowingDate: 'errDate', futureDate: 'errFuture' };
  if (errors.length) { $('plotError').textContent = t(msgMap[errors[0]] || 'errName'); return; }
  if (editingPlotId) {
    var ep = findPlot(editingPlotId);
    if (ep) { ep.name = input.name; ep.areaDecimals = input.areaDecimals; ep.variety = input.variety; ep.sowingDate = input.sowingDate; }
    editingPlotId = null;
  } else {
    state.plots.push({ id: uid(), name: input.name, areaDecimals: input.areaDecimals,
      variety: input.variety, sowingDate: input.sowingDate, harvests: [], sales: [], expenses: [] });
  }
  save();
  $('plotForm').reset(); $('plotVariety').value = 'Tossa'; $('plotAreaUnit').value = 'decimals'; $('plotError').textContent = '';
  render();
});
$('plotCancelBtn').addEventListener('click', function () {
  editingPlotId = null;
  $('plotForm').reset(); $('plotVariety').value = 'Tossa'; $('plotAreaUnit').value = 'decimals'; $('plotError').textContent = '';
  render();
});

// --- Harvest / sale / expense forms (detail view) ---
$('harvestForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var p = findPlot(selectedPlotId);
  if (!p) return;
  var today = getToday();
  var input = { date: $('harvDate').value, greenKg: +$('harvGreen').value, fibreKg: +$('harvFibre').value };
  var errors = JuteLogic.validateHarvest(p, input, today);
  var msgMap = { date: 'errDate', beforeSowing: 'errBeforeSowing', futureDate: 'errFuture', greenKg: 'errGreen', fibreKg: 'errFibre', fibreExceedsGreen: 'errFibreExceeds' };
  if (errors.length) { $('harvError').textContent = t(msgMap[errors[0]] || 'errDate'); return; }
  p.harvests.push({ id: uid(), date: input.date, greenKg: input.greenKg, fibreKg: input.fibreKg });
  save();
  $('harvestForm').reset(); $('harvError').textContent = '';
  render();
});
$('saleForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var p = findPlot(selectedPlotId);
  if (!p) return;
  var today = getToday();
  var input = { buyer: $('saleBuyer').value.trim(), date: $('saleDate').value, qtyKg: +$('saleQty').value, pricePerKg: +$('salePrice').value };
  var errors = JuteLogic.validateSale(p, input, today);
  var msgMap = { buyer: 'errBuyer', date: 'errDate', beforeSowing: 'errBeforeSowing', futureDate: 'errFuture', qty: 'errQty', qtyExceedsStock: 'errQtyStock', price: 'errPrice' };
  if (errors.length) { $('saleError').textContent = t(msgMap[errors[0]] || 'errBuyer'); return; }
  p.sales.push({ id: uid(), buyer: input.buyer, date: input.date, qtyKg: input.qtyKg, pricePerKg: input.pricePerKg });
  save();
  $('saleForm').reset(); $('saleError').textContent = '';
  render();
});
$('expenseForm').addEventListener('submit', function (e) {
  e.preventDefault();
  var p = findPlot(selectedPlotId);
  if (!p) return;
  var today = getToday();
  var input = { category: $('expCategory').value, date: $('expDate').value, amount: +$('expAmount').value };
  var errors = JuteLogic.validateExpense(p, input, today);
  var msgMap = { category: 'errCategory', date: 'errDate', beforeSowing: 'errBeforeSowing', futureDate: 'errFuture', amount: 'errAmount' };
  if (errors.length) { $('expError').textContent = t(msgMap[errors[0]] || 'errAmount'); return; }
  p.expenses.push({ id: uid(), category: input.category, date: input.date, amount: input.amount });
  save();
  $('expenseForm').reset(); $('expError').textContent = '';
  render();
});

// --- Export / import / erase ---
$('exportBtn').addEventListener('click', function () {
  var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'jute-market-bd-backup.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
});
$('exportShowBtn').addEventListener('click', function () {
  $('importBox').value = JSON.stringify(state, null, 2);
  $('importMsg').textContent = '';
});
$('importFile').addEventListener('change', function () {
  var f = $('importFile').files && $('importFile').files[0];
  if (!f) return;
  var r = new FileReader();
  r.onload = function () { $('importBox').value = String(r.result || ''); };
  r.readAsText(f);
});
$('importBtn').addEventListener('click', function () {
  try {
    var s = JSON.parse($('importBox').value);
    if (!JuteLogic.validateImport(s)) throw new Error('bad');
    state = s;
    state.lang = state.lang === 'bn' ? 'bn' : 'en';
    selectedPlotId = null; editingPlotId = null;
    save();
    $('importMsg').className = 'ok-msg';
    $('importMsg').textContent = t('importOk');
    render();
  } catch (err) {
    $('importMsg').className = 'error';
    $('importMsg').textContent = t('importBad');
  }
});
$('resetBtn').addEventListener('click', function () {
  var ans = window.prompt(t('erasePrompt'));
  if (ans === null) return;
  if (ans.trim().toUpperCase() !== 'DELETE') return;
  state = JUTE_emptyState();
  selectedPlotId = null; editingPlotId = null;
  save(); render();
});

render();
