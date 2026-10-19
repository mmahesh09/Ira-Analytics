"""Creates the monthly Razorpay plans (Pro/Business/Scale x INR/USD) and prints the RAZORPAY_PLANS line for .env.

Run from backend/ with the keys for the mode you want (test first, live at launch):
    .venv\\Scripts\\python -m scripts.create_razorpay_plans          (test keys)
    .venv\\Scripts\\python -m scripts.create_razorpay_plans --live   (live keys; refuses without the flag)
Safe to re-run: plans that already exist with the same name and amount are reused, not duplicated.
"""

import asyncio
import sys

from app import payments
from app.config import settings
from app.plans import PRICES

NAMES = {"pro": "Rankwise Pro", "business": "Rankwise Business", "scale": "Rankwise Scale"}


async def main() -> None:
    if not payments.configured():
        raise SystemExit("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env first.")
    live = settings.razorpay_key_id.startswith("rzp_live_")
    if live and "--live" not in sys.argv:
        raise SystemExit("These are LIVE keys. Re-run with --live if you really mean to create live plans.")
    print(f"Razorpay mode: {'LIVE' if live else 'TEST'}")

    existing = {(p["item"]["name"], p["item"]["currency"].lower(), p["item"]["amount"]): p["id"] for p in await payments.list_plans() if p.get("period") == "monthly"}
    ids: dict[str, str] = {}
    for (plan, currency), amount in PRICES.items():
        name = f"{NAMES[plan]} ({currency.upper()})"
        key = (name, currency, amount)
        if key in existing:
            ids[f"{plan}_{currency}"] = existing[key]
            print(f"  reused  {name}: {existing[key]}")
            continue
        try:
            created = await payments.create_plan(name, amount, currency, f"{NAMES[plan]} monthly subscription")
        except payments.PaymentsError as exc:
            # USD plans fail until International Payments is enabled on the account
            print(f"  skipped {name}: {exc}")
            continue
        ids[f"{plan}_{currency}"] = created["id"]
        print(f"  created {name}: {created['id']}")

    print("\nAdd this line to backend/.env:\n")
    print("RAZORPAY_PLANS=" + ",".join(f"{k}={v}" for k, v in sorted(ids.items())))
    if not any(k.endswith("_usd") for k in ids):
        print("\n(No USD plans yet: enable International Payments in Razorpay, re-run, then set RAZORPAY_USD_ENABLED=true.)")


if __name__ == "__main__":
    asyncio.run(main())
