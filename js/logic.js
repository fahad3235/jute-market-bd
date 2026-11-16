'use strict';
// jute-market-bd -- pure logic (no DOM). Dates are 'YYYY-MM-DD' strings.
// Loaded in the browser and in Node tests alike.
// All agronomy numbers are TYPICAL RANGES, not promises:
//   harvest ~115 days after sowing (typical 110-120 days),
//   retting window starts ~14 days after harvest, ~21 days typical.

var BIGHA_DECIMALS = 33; // 1 bigha = 33 decimals
var HARVEST_DAYS = 115;  // typical cycle; labelled 110-120 days in the UI
var RETTING_START_DAYS = 14;
var RETTING_END_DAYS = 21;
var VARIETIES = ['Tossa', 'White', 'Mesta', 'Kenaf'];
var EXPENSE_CATEGORIES = ['Seed', 'Fertilizer', 'Labour', 'Retting', 'Transport', 'Other'];

function parseDate(s) {
  var p = String(s).split('-');
  return Date.UTC(+p[0], +p[1] - 1, +p[2]);
}
function isValidDateStr(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  var p = String(s).split('-');
  var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
}
function addDays(dateStr, n) {
  return new Date(parseDate(dateStr) + n * 86400000).toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}
function todayLocal() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}

// --- Area conversion: 1 bigha = 33 decimals ---
function bighaToDecimals(bigha) {
  return Math.round((+bigha || 0) * BIGHA_DECIMALS * 100) / 100;
}
function decimalsToBigha(decimals) {
  return Math.round(((+decimals || 0) / BIGHA_DECIMALS) * 100) / 100;
}

// --- Timeline ---
// Plot: {id, name, areaDecimals, variety, sowingDate,
//        harvests:[{id,date,greenKg,fibreKg}], sales:[{id,buyer,date,qtyKg,pricePerKg}],
//        expenses:[{id,category,date,amount}]}
function expectedHarvestDate(plot) {
  return addDays(plot.sowingDate, HARVEST_DAYS);
}
function latestHarvest(plot) {
  if (!plot.harvests || !plot.harvests.length) return null;
  var best = plot.harvests[0];
  for (var i = 1; i < plot.harvests.length; i++) {
    if (plot.harvests[i].date > best.date) best = plot.harvests[i];
  }
  return best;
}
function rettingWindow(plot) {
  var h = latestHarvest(plot);
  if (!h) return null;
  return { start: addDays(h.date, RETTING_START_DAYS), end: addDays(h.date, RETTING_END_DAYS) };
}

// --- Aggregates per plot ---
function totalFibre(plot) {
  return (plot.harvests || []).reduce(function (s, h) { return s + (+h.fibreKg || 0); }, 0);
}
function totalGreen(plot) {
  return (plot.harvests || []).reduce(function (s, h) { return s + (+h.greenKg || 0); }, 0);
}
function totalSoldQty(plot) {
  return (plot.sales || []).reduce(function (s, x) { return s + (+x.qtyKg || 0); }, 0);
}
function totalSales(plot) {
  return (plot.sales || []).reduce(function (s, x) { return s + (+x.qtyKg || 0) * (+x.pricePerKg || 0); }, 0);
}
function totalExpenses(plot) {
  return (plot.expenses || []).reduce(function (s, x) { return s + (+x.amount || 0); }, 0);
}
function plotProfit(plot) {
  return totalSales(plot) - totalExpenses(plot);
}
function unsoldFibre(plot) {
  return Math.max(0, totalFibre(plot) - totalSoldQty(plot));
}
function yieldPerDecimal(plot) {
  if (!plot.areaDecimals || plot.areaDecimals <= 0) return null;
  return totalFibre(plot) / plot.areaDecimals;
}

// --- Status, auto-derived from the plot's own records ---
// growing | harvestDue | harvested | retting | retted | sold
function plotStatus(plot, today) {
  var fibre = totalFibre(plot);
  if (fibre > 0 && totalSoldQty(plot) >= fibre) return 'sold';
  var h = latestHarvest(plot);
  if (h) {
    if (daysBetween(today, addDays(h.date, RETTING_START_DAYS)) > 0) return 'harvested';
    if (daysBetween(today, addDays(h.date, RETTING_END_DAYS)) >= 0) return 'retting';
    return 'retted';
  }
  if (daysBetween(today, expectedHarvestDate(plot)) < 0) return 'harvestDue';
  return 'growing';
}

// --- Dashboard totals across all plots ---
function dashboardTotals(plots) {
  var t = { plots: plots.length, totalArea: 0, totalFibre: 0, totalSales: 0, totalExpenses: 0, netProfit: 0 };
  plots.forEach(function (p) {
    t.totalArea += +p.areaDecimals || 0;
    t.totalFibre += totalFibre(p);
    t.totalSales += totalSales(p);
    t.totalExpenses += totalExpenses(p);
  });
  t.netProfit = t.totalSales - t.totalExpenses;
  return t;
}

// --- Due / overdue items, computed against today ---
function dueItems(plots, today) {
  var out = { harvestSoon: [], harvestOverdue: [], rettingSoon: [], rettingOverdue: [] };
  plots.forEach(function (p) {
    var h = latestHarvest(p);
    if (!h) {
      var exp = expectedHarvestDate(p);
      var d = daysBetween(today, exp);
      if (d < 0) out.harvestOverdue.push({ plotId: p.id, name: p.name, date: exp, daysOverdue: -d });
      else if (d <= 7) out.harvestSoon.push({ plotId: p.id, name: p.name, date: exp, daysLeft: d });
    } else if (plotStatus(p, today) !== 'sold') {
      var w = rettingWindow(p);
      var ds = daysBetween(today, w.start);
      var de = daysBetween(today, w.end);
      if (ds > 0 && ds <= 7) out.rettingSoon.push({ plotId: p.id, name: p.name, date: w.start, daysLeft: ds });
      else if (de < 0) out.rettingOverdue.push({ plotId: p.id, name: p.name, date: w.end, daysOverdue: -de });
    }
  });
  return out;
}

// --- Validation (input objects use raw form values) ---
function isPosNum(v, max) {
  var n = +v;
  return isFinite(n) && n > 0 && (max === undefined || n <= max);
}
function validatePlot(input, today) {
  var errors = [];
  if (!input.name || !String(input.name).trim()) errors.push('name');
  if (!isPosNum(input.areaDecimals, 100000)) errors.push('area');
  if (VARIETIES.indexOf(input.variety) === -1) errors.push('variety');
  if (!isValidDateStr(input.sowingDate)) errors.push('sowingDate');
  else if (daysBetween(input.sowingDate, today) < 0) errors.push('futureDate');
  return errors;
}
function validateHarvest(plot, input, today) {
  var errors = [];
  if (!isValidDateStr(input.date)) errors.push('date');
  else {
    if (daysBetween(plot.sowingDate, input.date) < 0) errors.push('beforeSowing');
    if (daysBetween(input.date, today) < 0) errors.push('futureDate');
  }
  if (!isPosNum(input.greenKg, 1000000)) errors.push('greenKg');
  if (!isPosNum(input.fibreKg, 1000000)) errors.push('fibreKg');
  else if (isPosNum(input.greenKg) && +input.fibreKg > +input.greenKg) errors.push('fibreExceedsGreen');
  return errors;
}
function validateSale(plot, input, today) {
  var errors = [];
  if (!input.buyer || !String(input.buyer).trim()) errors.push('buyer');
  if (!isValidDateStr(input.date)) errors.push('date');
  else {
    if (daysBetween(plot.sowingDate, input.date) < 0) errors.push('beforeSowing');
    if (daysBetween(input.date, today) < 0) errors.push('futureDate');
  }
  if (!isPosNum(input.qtyKg, 1000000)) errors.push('qty');
  else if (+input.qtyKg > unsoldFibre(plot)) errors.push('qtyExceedsStock');
  if (!isPosNum(input.pricePerKg, 1000000)) errors.push('price');
  return errors;
}
function validateExpense(plot, input, today) {
  var errors = [];
  if (EXPENSE_CATEGORIES.indexOf(input.category) === -1) errors.push('category');
  if (!isValidDateStr(input.date)) errors.push('date');
  else {
    if (daysBetween(plot.sowingDate, input.date) < 0) errors.push('beforeSowing');
    if (daysBetween(input.date, today) < 0) errors.push('futureDate');
  }
  if (!isPosNum(input.amount, 10000000)) errors.push('amount');
  return errors;
}
function saleTotal(qtyKg, pricePerKg) {
  return (+qtyKg || 0) * (+pricePerKg || 0);
}

// --- Strict import validation: shape + sane values, nothing else ---
function validateImport(obj) {
  if (!obj || obj.app !== 'jute-market-bd') return false;
  if (!Array.isArray(obj.plots)) return false;
  for (var i = 0; i < obj.plots.length; i++) {
    var p = obj.plots[i];
    if (!p || typeof p !== 'object') return false;
    if (typeof p.id !== 'string' || !p.id) return false;
    if (typeof p.name !== 'string' || !p.name.trim()) return false;
    if (!isPosNum(p.areaDecimals, 100000)) return false;
    if (VARIETIES.indexOf(p.variety) === -1) return false;
    if (!isValidDateStr(p.sowingDate)) return false;
    if (!Array.isArray(p.harvests) || !Array.isArray(p.sales) || !Array.isArray(p.expenses)) return false;
    for (var j = 0; j < p.harvests.length; j++) {
      var h = p.harvests[j];
      if (!h || typeof h.id !== 'string' || !isValidDateStr(h.date)) return false;
      if (!isPosNum(h.greenKg, 1000000) || !isPosNum(h.fibreKg, 1000000)) return false;
      if (+h.fibreKg > +h.greenKg) return false;
    }
    for (var k = 0; k < p.sales.length; k++) {
      var s = p.sales[k];
      if (!s || typeof s.id !== 'string' || typeof s.buyer !== 'string' || !s.buyer.trim()) return false;
      if (!isValidDateStr(s.date)) return false;
      if (!isPosNum(s.qtyKg, 1000000) || !isPosNum(s.pricePerKg, 1000000)) return false;
    }
    for (var m = 0; m < p.expenses.length; m++) {
      var e = p.expenses[m];
      if (!e || typeof e.id !== 'string' || !isValidDateStr(e.date)) return false;
      if (EXPENSE_CATEGORIES.indexOf(e.category) === -1) return false;
      if (!isPosNum(e.amount, 10000000)) return false;
    }
  }
  return true;
}

function fmt(n, decimals) {
  if (n === null || n === undefined || isNaN(n)) return '\u2014';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals || 0, maximumFractionDigits: decimals || 0 });
}
var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
function toBnDigits(s) {
  return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
}

var API = {
    BIGHA_DECIMALS: BIGHA_DECIMALS, HARVEST_DAYS: HARVEST_DAYS,
    RETTING_START_DAYS: RETTING_START_DAYS, RETTING_END_DAYS: RETTING_END_DAYS,
    VARIETIES: VARIETIES, EXPENSE_CATEGORIES: EXPENSE_CATEGORIES,
    parseDate: parseDate, isValidDateStr: isValidDateStr, addDays: addDays,
    daysBetween: daysBetween, todayLocal: todayLocal,
    bighaToDecimals: bighaToDecimals, decimalsToBigha: decimalsToBigha,
    expectedHarvestDate: expectedHarvestDate, latestHarvest: latestHarvest,
    rettingWindow: rettingWindow, plotStatus: plotStatus,
    totalFibre: totalFibre, totalGreen: totalGreen, totalSoldQty: totalSoldQty,
    totalSales: totalSales, totalExpenses: totalExpenses, plotProfit: plotProfit,
    unsoldFibre: unsoldFibre, yieldPerDecimal: yieldPerDecimal,
    dashboardTotals: dashboardTotals, dueItems: dueItems,
    validatePlot: validatePlot, validateHarvest: validateHarvest,
    validateSale: validateSale, validateExpense: validateExpense,
    saleTotal: saleTotal, validateImport: validateImport,
    fmt: fmt, toBnDigits: toBnDigits
  };
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}
if (typeof window !== 'undefined') window.JuteLogic = API;
