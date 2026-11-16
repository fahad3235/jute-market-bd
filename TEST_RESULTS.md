# Test results — jute-market-bd (run #356, 2026-11-16 17:00 slot)

## Unit tests — 47/47 passed

`node tests/logic.test.js` — pure logic, no DOM.

- Date math: daysBetween (30 days), addDays crosses month and year boundaries, isValidDateStr rejects 2026-02-30 and garbage.
- Area conversion: 1 bigha = 33 decimals, 2.5 bigha = 82.5 decimals, 33 decimals = 1 bigha, 66 decimals = 2 bigha.
- Timeline: expected harvest is sowing + 115 days (2026-07-01 → 2026-10-24; 2026-09-15 → 2027-01-08 across the year boundary); retting window null with no harvest, harvest +14 to +21 days with one (2026-10-24 → 2026-11-07 to 2026-11-14).
- Status derivation: growing before expected harvest; harvestDue after it with no harvest; harvested just after harvest; retting inside the window; retted after it; sold when all fibre sold; retted when only part sold.
- Aggregates on a 2-harvest / 2-sale / 2-expense fixture: totalFibre 180, totalGreen 1500, totalSoldQty 150, totalSales 8,500, totalExpenses 3,500, plotProfit 5,000, unsoldFibre 30, yieldPerDecimal 180/33, saleTotal 100×55 = 5,500; dashboardTotals over two plots (2 plots, 99 decimals, 180 kg, 8,500 sales, 3,500 expenses, 5,000 net).
- Due items: harvest overdue + harvest soon (3 days left) + retting soon on one fixture; retting overdue 6 days on another.
- Validation: good plot/harvest/sale/expense pass; empty name + zero area + future sowing flagged; unknown variety + negative area flagged; fibre > green, future date, before-sowing harvest flagged; negative qty, zero price, qty over unsold stock (31 kg vs 30 kg unsold), empty buyer flagged; bad category, zero amount, future expense date flagged.
- Import validation: good backup accepted; wrong app, non-array plots, bad variety, and fibre > green in a harvest rejected.
- Formatting: fmt(8500) = "8,500", fmt(5.4545, 2) = "5.45", toBnDigits("2026") = Bengali 2026.

## Headless-Chrome smoke tests — 61/61 passed

`node tests/smoke.js` — raw CDP, headless_shell-1187, file://, 0 console/page errors.

Hand-verified flows: empty state (3 tabs, 0 plots, 0 fibre, net profit ৳0, due/plots/chart empty states, Bangla lang button, asof note hidden); `?asof=2026-11-16` shows the as-of note naming the date; empty plot name shows an error; add plot "North Field", 1 bigha stored as 33 decimals, dashboard area 33, due list flags harvest overdue, row shows "Harvest due" badge; edit pre-fills and renames to "North Field 2"; detail view shows timeline with expected harvest date and the "110" typical-range label; empty harvest date errors; add harvest (1000 kg green, 120 kg fibre) — stats show 120 kg and yield 3.64 kg/decimal, status Harvested; add sale (Karim, 100 kg × ৳55) — row total ৳5,500; a second sale of 50 kg is blocked (only 20 kg unsold) and still 1 sale stored; add expense (Seed, ৳2,000) — plot profit ৳3,500; dashboard totals (fibre 120, sales ৳5,500, expenses ৳2,000, net ৳3,500, 1 chart bar, due list clear); Bangla toggle (title in Bengali, plot count in Bengali digit ১, persists after reload, plot persists, back to EN); export fills the JSON box naming jute-market-bd; wrong-app import rejected with an error and existing data kept; typed-DELETE reset clears everything; footer mentions localStorage and "not market quotes"; 390px no horizontal overflow on all 3 tabs; zero non-file network requests.

Note: the real-download Export button (Blob + anchor click) was not clicked in the smoke test — the "Show JSON" path was verified instead, which exercises the same serialized state.

## Repairs

0 app bugs. No repair cycles needed — both suites passed on first run after the build. One test expectation was corrected before the first run (retting-overdue days: 6, not 2 — window ended 2026-11-10); the app was correct, the test was wrong.
