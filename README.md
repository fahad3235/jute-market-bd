# Jute Market BD

Offline jute cultivation & trading log for Bangladeshi farmers — track each plot from sowing to sale, know when harvest and retting are due, and see the real profit per plot. No account, no network, no data collection. Ships empty: your records start blank.

## Features

1. **Plot registry** — add a plot (name, area in decimals or bigha at 1 bigha = 33 decimals, variety: Tossa / White / Mesta / Kenaf, sowing date). Edit or delete any plot.
2. **Cultivation timeline** — per plot: sowing date → expected harvest (sowing + 115 days, labelled "typical 110–120 days") → retting window (starts ~14 days after harvest, ~21 days typical) → sold. All cycle numbers are labelled as typical ranges, not promises.
3. **Dashboard** — upcoming harvest/retting due within 7 days, overdue flags, totals (plots, total area, fibre kg, sales income, expenses, net profit), and a bar chart of fibre yield per plot.
4. **Harvest log** — per plot: harvest date, green plant weight (kg), fibre yield (kg); yield per decimal computed automatically; status becomes harvested / retting / retted.
5. **Sales ledger** — per plot: buyer name, date, quantity (kg), price per kg in ৳ entered by you; total auto-computed (qty × price). **Every price is your own record — there are no market prices anywhere in this app.**
6. **Expenses** — per plot: category (Seed / Fertilizer / Labour / Retting / Transport / Other), date, amount in ৳. Per-plot profit = total sales − total expenses.
7. **Bilingual** — English / Bangla toggle (persisted) with Bengali digits; all data in localStorage on the device.
8. **Backup & data** — download the whole log as JSON, import a backup (strict validation, bad files rejected with an error), erase-all with typed DELETE confirmation. Add `?asof=YYYY-MM-DD` to the page URL to view due dates as of a fixed date (used by the deterministic tests).

## The numbers

- 1 bigha = 33 decimals (area conversion).
- Expected harvest = sowing date + 115 days (typical 110–120 days).
- Retting window = harvest date + 14 days to + 21 days (typical).
- Yield per decimal = fibre yield (kg) ÷ area (decimals).
- Sale total = quantity (kg) × price per kg (৳).
- Plot profit = total sales − total expenses.
- Status is auto-derived: growing → harvest due → harvested → retting → retted → sold (sold when all harvested fibre has been sold).
- A sale cannot exceed the plot's unsold fibre.

## Run locally

Just open `index.html` in any browser. No build step, no dependencies, no network requests.

## Tests

```sh
node tests/logic.test.js   # 47 pure-logic unit checks
node tests/smoke.js        # 61 headless-Chrome (CDP) UI checks
```

## Stack

Vanilla HTML / CSS / JavaScript, localStorage. No frameworks, no build tools.

## Limitations

- Harvest and retting dates are typical ranges for jute in Bangladesh, not promises — your field, variety, weather and retting water change the real dates.
- Prices are your own records only; this app contains no market quotes and cannot tell you the current jute price.
- Data lives in one browser's localStorage — use Download JSON to move it to another device.
- Dates are calendar days; the `?asof=` override is for viewing/testing, not for back-dating records (future dates are rejected by validation).

## Status

Complete MVP. See `TEST_RESULTS.md` for the verified test run.
