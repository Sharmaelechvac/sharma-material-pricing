#!/usr/bin/env python3
"""Build prices.json from the office price tracker CSV.

Usage: python3 tools/build_data.py [path-to-price-tracker.csv]
Default CSV: ~/workspace/cost-estimator/price-tracker.csv

CSV columns: item, price, unit, supplier, date, source_doc, status
Optional columns used when present: house (house or job name for the rollup).

Trade split: an item whose name starts with "HVAC:" belongs to HVAC (the
prefix is stripped for display). Rows whose status is tagged "(HVAC)" in the
tracker (the web-priced HVAC equipment and duct lines) are HVAC too.
Everything else is electrical.
Only rows with a parseable price and a non-empty item are carried over.
prices.json is a local working file (gitignored); encrypt it with
tools/encrypt_prices.py before committing — only prices.enc.json is published.
"""
import csv, json, os, sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_CSV = os.path.expanduser("~/workspace/cost-estimator/price-tracker.csv")


def main():
    csv_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    entries, skipped = [], 0
    if os.path.exists(csv_path):
        with open(csv_path, newline="", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                item = (row.get("item") or "").strip()
                if not item:
                    skipped += 1
                    continue
                try:
                    price = float(str(row.get("price") or "").replace("$", "").replace(",", "").strip())
                except ValueError:
                    skipped += 1
                    continue
                status_raw = (row.get("status") or "")
                trade = "electrical"
                if item.upper().startswith("HVAC:"):
                    trade = "hvac"
                    item = item.split(":", 1)[1].strip()
                elif "(HVAC)" in status_raw.upper():
                    trade = "hvac"
                e = {
                    "item": item,
                    "trade": trade,
                    "price": price,
                    "unit": (row.get("unit") or "").strip(),
                    "supplier": (row.get("supplier") or "").strip(),
                    "date": (row.get("date") or "").strip(),
                    "source": (row.get("source_doc") or "").strip(),
                    "status": (row.get("status") or "").strip(),
                }
                house = (row.get("house") or "").strip()
                if house:
                    e["house"] = house
                entries.append(e)
    else:
        print("NOTE: tracker CSV not found at %s — building an empty dataset." % csv_path)

    data = {
        "meta": {
            "company": "Sharma Electric & HVAC",
            "generated": date.today().isoformat(),
            "source": "cost-estimator/price-tracker.csv",
            "entries": len(entries),
            "skippedRows": skipped,
        },
        "entries": entries,
    }
    out = os.path.join(ROOT, "prices.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print("Wrote %s (%d entries, %d skipped)." % (out, len(entries), skipped))


if __name__ == "__main__":
    main()
