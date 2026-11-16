// jute-market-bd -- pure-logic unit tests. Usage: node tests/logic.test.js
const assert = require('node:assert');
const L = require('../js/logic.js');
let n = 0, pass = 0;
function check(name, fn) {
  n++;
  try { fn(); pass++; console.log('ok - ' + name); }
  catch (e) { console.log('FAIL - ' + name + ' :: ' + e.message); }
}

const plot = (o) => Object.assign({
  id: 'x', name: 'North Field', areaDecimals: 33, variety: 'Tossa',
  sowingDate: '2026-07-01', harvests: [], sales: [], expenses: []
}, o);
const TODAY = '2026-11-16';

// --- Date math ---
check('daysBetween counts whole days', () => assert.strictEqual(L.daysBetween('2026-07-01', '2026-07-31'), 30));
check('addDays crosses year boundary', () => assert.strictEqual(L.addDays('2026-12-28', 5), '2027-01-02'));
check('addDays crosses month boundary', () => assert.strictEqual(L.addDays('2026-10-28', 5), '2026-11-02'));
check('isValidDateStr rejects 2026-02-30', () => assert.strictEqual(L.isValidDateStr('2026-02-30'), false));
check('isValidDateStr accepts 2026-11-16', () => assert.strictEqual(L.isValidDateStr('2026-11-16'), true));
check('isValidDateStr rejects garbage', () => assert.strictEqual(L.isValidDateStr('16/11/2026'), false));

// --- Area conversion: 1 bigha = 33 decimals ---
check('bighaToDecimals: 1 bigha = 33 decimals', () => assert.strictEqual(L.bighaToDecimals(1), 33));
check('bighaToDecimals: 2.5 bigha = 82.5 decimals', () => assert.strictEqual(L.bighaToDecimals(2.5), 82.5));
check('decimalsToBigha: 33 decimals = 1 bigha', () => assert.strictEqual(L.decimalsToBigha(33), 1));
check('decimalsToBigha: 66 decimals = 2 bigha', () => assert.strictEqual(L.decimalsToBigha(66), 2));

// --- Timeline: harvest +115 days, retting +14 / +21 ---
check('expectedHarvestDate is sowing + 115 days', () => assert.strictEqual(L.expectedHarvestDate(plot({})), '2026-10-24'));
check('expectedHarvestDate crosses year boundary', () => assert.strictEqual(L.expectedHarvestDate(plot({ sowingDate: '2026-09-15' })), '2027-01-08'));
check('rettingWindow null with no harvest', () => assert.strictEqual(L.rettingWindow(plot({})), null));
check('rettingWindow is harvest +14 to +21 days', () => {
  const p = plot({ harvests: [{ id: 'h1', date: '2026-10-24', greenKg: 1000, fibreKg: 120 }] });
  assert.deepStrictEqual(L.rettingWindow(p), { start: '2026-11-07', end: '2026-11-14' });
});

// --- Status derivation ---
check('status growing before expected harvest', () => assert.strictEqual(L.plotStatus(plot({ sowingDate: '2026-10-01' }), '2026-11-16'), 'growing'));
check('status harvestDue after expected harvest, no harvest', () => assert.strictEqual(L.plotStatus(plot({}), TODAY), 'harvestDue'));
check('status harvested just after harvest', () => {
  const p = plot({ harvests: [{ id: 'h1', date: '2026-11-10', greenKg: 1000, fibreKg: 120 }] });
  assert.strictEqual(L.plotStatus(p, TODAY), 'harvested');
});
check('status retting inside retting window', () => {
  const p = plot({ harvests: [{ id: 'h1', date: '2026-10-30', greenKg: 1000, fibreKg: 120 }] });
  assert.strictEqual(L.plotStatus(p, TODAY), 'retting');
});
check('status retted after retting window', () => {
  const p = plot({ harvests: [{ id: 'h1', date: '2026-10-20', greenKg: 1000, fibreKg: 120 }] });
  assert.strictEqual(L.plotStatus(p, TODAY), 'retted');
});
check('status sold when all fibre sold', () => {
  const p = plot({
    harvests: [{ id: 'h1', date: '2026-10-20', greenKg: 1000, fibreKg: 120 }],
    sales: [{ id: 's1', buyer: 'Karim', date: '2026-11-10', qtyKg: 120, pricePerKg: 55 }]
  });
  assert.strictEqual(L.plotStatus(p, TODAY), 'sold');
});
check('status retted when only part sold', () => {
  const p = plot({
    harvests: [{ id: 'h1', date: '2026-10-20', greenKg: 1000, fibreKg: 120 }],
    sales: [{ id: 's1', buyer: 'Karim', date: '2026-11-10', qtyKg: 50, pricePerKg: 55 }]
  });
  assert.strictEqual(L.plotStatus(p, TODAY), 'retted');
});

// --- Aggregates ---
const rich = plot({
  harvests: [
    { id: 'h1', date: '2026-10-20', greenKg: 1000, fibreKg: 120 },
    { id: 'h2', date: '2026-10-22', greenKg: 500, fibreKg: 60 }
  ],
  sales: [
    { id: 's1', buyer: 'Karim', date: '2026-11-10', qtyKg: 100, pricePerKg: 55 },
    { id: 's2', buyer: 'Rahim', date: '2026-11-12', qtyKg: 50, pricePerKg: 60 }
  ],
  expenses: [
    { id: 'e1', category: 'Seed', date: '2026-07-01', amount: 2000 },
    { id: 'e2', category: 'Labour', date: '2026-08-15', amount: 1500 }
  ]
});
check('totalFibre sums harvests', () => assert.strictEqual(L.totalFibre(rich), 180));
check('totalGreen sums harvests', () => assert.strictEqual(L.totalGreen(rich), 1500));
check('totalSoldQty sums sales', () => assert.strictEqual(L.totalSoldQty(rich), 150));
check('totalSales = sum qty x price', () => assert.strictEqual(L.totalSales(rich), 100 * 55 + 50 * 60));
check('totalExpenses sums expenses', () => assert.strictEqual(L.totalExpenses(rich), 3500));
check('plotProfit = sales - expenses', () => assert.strictEqual(L.plotProfit(rich), 8500 - 3500));
check('unsoldFibre = fibre - sold', () => assert.strictEqual(L.unsoldFibre(rich), 30));
check('yieldPerDecimal = 180 / 33', () => assert.ok(Math.abs(L.yieldPerDecimal(rich) - 180 / 33) < 1e-9));
check('saleTotal = qty x price', () => assert.strictEqual(L.saleTotal(100, 55), 5500));
check('dashboardTotals aggregates two plots', () => {
  const t = L.dashboardTotals([rich, plot({ id: 'y', name: 'South', areaDecimals: 66 })]);
  assert.strictEqual(t.plots, 2);
  assert.strictEqual(t.totalArea, 99);
  assert.strictEqual(t.totalFibre, 180);
  assert.strictEqual(t.totalSales, 8500);
  assert.strictEqual(t.totalExpenses, 3500);
  assert.strictEqual(t.netProfit, 5000);
});

// --- Due items ---
check('dueItems: harvest overdue + harvest soon + retting soon', () => {
  const plots = [
    plot({ id: 'a', name: 'Overdue', sowingDate: '2026-07-01' }),            // expected 2026-10-24 < today
    plot({ id: 'b', name: 'Soon', sowingDate: '2026-07-27' }),               // expected 2026-11-19, in 3 days
    plot({ id: 'c', name: 'Later', sowingDate: '2026-08-20' }),              // expected 2026-12-13, not due
    plot({ id: 'd', name: 'Retting', sowingDate: '2026-07-01',
      harvests: [{ id: 'h1', date: '2026-11-05', greenKg: 800, fibreKg: 100 }] }) // retting starts 2026-11-19
  ];
  const d = L.dueItems(plots, TODAY);
  assert.strictEqual(d.harvestOverdue.length, 1);
  assert.strictEqual(d.harvestOverdue[0].name, 'Overdue');
  assert.strictEqual(d.harvestSoon.length, 1);
  assert.strictEqual(d.harvestSoon[0].daysLeft, 3);
  assert.strictEqual(d.rettingSoon.length, 1);
  assert.strictEqual(d.rettingSoon[0].name, 'Retting');
  assert.strictEqual(d.rettingOverdue.length, 0);
});
check('dueItems: retting overdue when window passed', () => {
  const plots = [plot({ id: 'd', name: 'Late', harvests: [{ id: 'h1', date: '2026-10-20', greenKg: 800, fibreKg: 100 }] })];
  const d = L.dueItems(plots, TODAY);
  assert.strictEqual(d.rettingOverdue.length, 1);
  assert.strictEqual(d.rettingOverdue[0].daysOverdue, 6); // window ended 2026-11-10
});

// --- Validation ---
check('validatePlot accepts a good plot', () => {
  assert.deepStrictEqual(L.validatePlot({ name: 'North', areaDecimals: 33, variety: 'Tossa', sowingDate: '2026-07-01' }, TODAY), []);
});
check('validatePlot flags empty name + zero area + future sowing', () => {
  const e = L.validatePlot({ name: ' ', areaDecimals: 0, variety: 'Tossa', sowingDate: '2026-11-17' }, TODAY);
  assert.ok(e.includes('name') && e.includes('area') && e.includes('futureDate'));
});
check('validatePlot rejects unknown variety and negative area', () => {
  const e = L.validatePlot({ name: 'X', areaDecimals: -5, variety: 'Golden', sowingDate: '2026-07-01' }, TODAY);
  assert.ok(e.includes('area') && e.includes('variety'));
});
check('validateHarvest accepts a good harvest', () => {
  assert.deepStrictEqual(L.validateHarvest(plot({}), { date: '2026-10-24', greenKg: 1000, fibreKg: 120 }, TODAY), []);
});
check('validateHarvest rejects fibre > green, future date, before sowing', () => {
  const p = plot({});
  assert.ok(L.validateHarvest(p, { date: '2026-06-30', greenKg: 100, fibreKg: 120 }, TODAY).includes('beforeSowing'));
  assert.ok(L.validateHarvest(p, { date: '2026-11-17', greenKg: 100, fibreKg: 50 }, TODAY).includes('futureDate'));
  assert.ok(L.validateHarvest(p, { date: '2026-10-24', greenKg: 100, fibreKg: 120 }, TODAY).includes('fibreExceedsGreen'));
  assert.ok(L.validateHarvest(p, { date: '2026-10-24', greenKg: -5, fibreKg: 10 }, TODAY).includes('greenKg'));
});
check('validateSale accepts a good sale', () => {
  assert.deepStrictEqual(L.validateSale(rich, { buyer: 'Karim', date: '2026-11-14', qtyKg: 20, pricePerKg: 55 }, TODAY), []);
});
check('validateSale rejects negative qty, zero price, qty over stock, empty buyer', () => {
  assert.ok(L.validateSale(rich, { buyer: 'K', date: '2026-11-14', qtyKg: -5, pricePerKg: 55 }, TODAY).includes('qty'));
  assert.ok(L.validateSale(rich, { buyer: 'K', date: '2026-11-14', qtyKg: 10, pricePerKg: 0 }, TODAY).includes('price'));
  assert.ok(L.validateSale(rich, { buyer: 'K', date: '2026-11-14', qtyKg: 31, pricePerKg: 55 }, TODAY).includes('qtyExceedsStock'));
  assert.ok(L.validateSale(rich, { buyer: ' ', date: '2026-11-14', qtyKg: 10, pricePerKg: 55 }, TODAY).includes('buyer'));
});
check('validateExpense accepts a good expense', () => {
  assert.deepStrictEqual(L.validateExpense(plot({}), { category: 'Seed', date: '2026-07-02', amount: 2000 }, TODAY), []);
});
check('validateExpense rejects bad category, zero amount, future date', () => {
  const p = plot({});
  assert.ok(L.validateExpense(p, { category: 'Rent', date: '2026-07-02', amount: 100 }, TODAY).includes('category'));
  assert.ok(L.validateExpense(p, { category: 'Seed', date: '2026-07-02', amount: 0 }, TODAY).includes('amount'));
  assert.ok(L.validateExpense(p, { category: 'Seed', date: '2026-11-20', amount: 100 }, TODAY).includes('futureDate'));
});

// --- Import validation ---
check('validateImport accepts a good backup', () => {
  assert.strictEqual(L.validateImport({ app: 'jute-market-bd', lang: 'en', plots: [rich] }), true);
});
check('validateImport rejects wrong app, bad plots, bad variety', () => {
  assert.strictEqual(L.validateImport({ app: 'gas-cylinder-bd', plots: [] }), false);
  assert.strictEqual(L.validateImport({ app: 'jute-market-bd', plots: 'nope' }), false);
  assert.strictEqual(L.validateImport({ app: 'jute-market-bd', plots: [plot({ variety: 'Golden' })] }), false);
  assert.strictEqual(L.validateImport(null), false);
  assert.strictEqual(L.validateImport({ app: 'jute-market-bd', plots: [plot({ harvests: [{ id: 'h', date: '2026-10-24', greenKg: 10, fibreKg: 20 }] })] }), false);
});

// --- Formatting ---
check('fmt adds commas', () => assert.strictEqual(L.fmt(8500), '8,500'));
check('fmt decimals', () => assert.strictEqual(L.fmt(5.4545, 2), '5.45'));
check('toBnDigits converts 2026', () => assert.strictEqual(L.toBnDigits('2026'), '\u09e8\u09e6\u09e8\u09ec'));

console.log('\n' + n + ' checks, ' + (n - pass) + ' failed');
process.exit(n - pass ? 1 : 0);
