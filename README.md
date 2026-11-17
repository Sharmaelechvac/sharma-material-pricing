# Sharma Material Pricing

One app, two links — Electrical and HVAC prices are never blended:

- Landing: https://sharmaelechvac.github.io/sharma-material-pricing/
- Electrical: https://sharmaelechvac.github.io/sharma-material-pricing/electrical/
- HVAC: https://sharmaelechvac.github.io/sharma-material-pricing/hvac/
- Combined: https://sharmaelechvac.github.io/sharma-material-pricing/combined/

Both trade pages sit behind the office code (same lock as Sharma AR / P&L).
Prices are published only as `prices.enc.json` (AES-GCM, key from the office
code). The code is never in this repo. `prices.json` is a local working file
and is gitignored — never commit it.

## Data

Source of truth: the office price tracker, `cost-estimator/price-tracker.csv`
(columns: item, price, unit, supplier, date, source_doc, status; an optional
`house` column feeds the per-house rollup). Items starting with `HVAC:` go to
the HVAC page; everything else is electrical. No price is ever typed into the
app by hand — if it is not in the tracker, it is not in the app.

## Refresh the prices

```bash
python3 tools/build_data.py            # CSV -> prices.json
SHARMA_PASSCODE=... python3 tools/encrypt_prices.py   # -> prices.enc.json
git add prices.enc.json && git commit -m "Refresh material prices" && git push
```

Publishing: GitHub Pages serves the `main` branch root directly (same setup
as the EXJ tracker); a push updates the site in about a minute.
