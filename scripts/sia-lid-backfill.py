#!/usr/bin/env python3
"""Sia LID backfill — recover hidden member phone numbers from the raw event log.

WhatsApp's privacy migration keys group members by a LID (`…@lid`) that hides the
phone. Baileys still tells us the pairing in four raw event types, all already
sitting in sia.wag_raw_events (the raw-first law paying off):

  lid-mapping.update         {pn: <phone>@s.whatsapp.net, lid: <lid>@lid}
  group-participants.update  participants[{id: <lid>@lid, phoneNumber: <phone>@…}]
  groups.upsert              participants[{id, phoneNumber}]
  contacts.upsert / .update  [{id: <phone>@…, lid, phoneNumber, name}]

This script harvests every (lid, phone) pair OFFLINE (never a live-session query,
the Sia discipline) and reconciles sia.wag_contacts so that every @lid member
resolves to a phone:
  - a contact keyed by the phone jid gains its `lid`
  - a contact keyed by the lid jid gains its `phone`
  - neither exists → a new contact row (jid = phone jid, lid, phone)
Conflicts (one lid seen with two phones, or the reverse) are reported and SKIPPED,
never guessed. Idempotent: a second run changes nothing.

DRY-RUN by default. `--apply` writes.

  set -a && source .env.local && set +a
  python3 scripts/sia-lid-backfill.py            # report only
  python3 scripts/sia-lid-backfill.py --apply
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from collections import defaultdict

BASE = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
EVENT_TYPES = ("lid-mapping.update", "group-participants.update", "groups.upsert",
               "contacts.upsert", "contacts.update")


def rest(method: str, path: str, body=None, prefer: str | None = None):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
               ("Accept-Profile" if method == "GET" else "Content-Profile"): "sia"}
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(f"{BASE}/rest/v1/{path}", method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers=headers)
    with urllib.request.urlopen(req, timeout=180) as res:
        raw = res.read()
        return json.loads(raw) if raw else None


def get_all(path: str, page: int = 1000):
    rows, start = [], 0
    while True:
        headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Accept-Profile": "sia",
                   "Range-Unit": "items", "Range": f"{start}-{start + page - 1}"}
        req = urllib.request.Request(f"{BASE}/rest/v1/{path}", headers=headers)
        chunk = json.load(urllib.request.urlopen(req, timeout=180))
        rows.extend(chunk)
        if len(chunk) < page:
            return rows
        start += page


def is_lid(j: str) -> bool:
    return isinstance(j, str) and j.endswith("@lid")


def is_pn(j: str) -> bool:
    return isinstance(j, str) and j.endswith("@s.whatsapp.net")


def harvest_pairs(payload) -> list[tuple[str, str]]:
    """Walk any payload shape and return (lid_jid, phone_jid) pairs."""
    pairs: list[tuple[str, str]] = []

    def visit(node):
        if isinstance(node, dict):
            lid = node.get("lid") if is_lid(node.get("lid", "")) else (node.get("id") if is_lid(node.get("id", "")) else None)
            pn = next((node[k] for k in ("pn", "phoneNumber", "id") if is_pn(node.get(k, ""))), None)
            if lid and pn:
                pairs.append((lid, pn))
            for v in node.values():
                visit(v)
        elif isinstance(node, list):
            for v in node:
                visit(v)

    visit(payload)
    return pairs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write to sia.wag_contacts (default: dry run)")
    args = ap.parse_args()
    if not BASE or not KEY:
        print("✗ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — source .env.local")
        return 1

    # 1. Harvest pairs from the raw log.
    lid_to_pn: dict[str, set[str]] = defaultdict(set)
    seen_events = 0
    for et in EVENT_TYPES:
        rows = get_all(f"wag_raw_events?select=payload&event_type=eq.{urllib.parse.quote(et)}")
        seen_events += len(rows)
        for r in rows:
            for lid, pn in harvest_pairs(r["payload"]):
                lid_to_pn[lid].add(pn)
    conflicts = {l: p for l, p in lid_to_pn.items() if len(p) > 1}
    clean = {l: next(iter(p)) for l, p in lid_to_pn.items() if len(p) == 1}
    print(f"raw events scanned: {seen_events}")
    print(f"distinct lids with a phone: {len(lid_to_pn)}  (clean {len(clean)}, conflicting {len(conflicts)} → skipped)")

    # 2. Reconcile against wag_contacts.
    contacts = get_all("wag_contacts?select=jid,lid,phone,push_name")
    by_jid = {c["jid"]: c for c in contacts}
    by_lid = {c["lid"]: c for c in contacts if c["lid"]}
    members = get_all("wag_group_members?select=group_jid,member_jid&left_at=is.null")
    lid_members = {m["member_jid"] for m in members if is_lid(m["member_jid"])}

    def resolvable(mjid: str) -> bool:
        c = by_jid.get(mjid) or by_lid.get(mjid)
        return bool(c and c["phone"])

    before = sum(1 for m in lid_members if resolvable(m))

    set_lid, set_phone, inserts = [], [], []
    for lid, pn in clean.items():
        phone = "+" + re.sub(r"\D", "", pn.split("@")[0])
        c_pn = by_jid.get(pn)
        c_lid = by_jid.get(lid) or by_lid.get(lid)
        if c_pn is not None:
            if not c_pn["lid"]:
                set_lid.append((c_pn["jid"], lid))
            if not c_pn["phone"]:
                set_phone.append((c_pn["jid"], phone))
        elif c_lid is not None:
            patch = {}
            if not c_lid["phone"]:
                patch["phone"] = phone
            if not c_lid["lid"]:
                patch["lid"] = lid
            if patch:
                set_phone.append((c_lid["jid"], phone)) if "phone" in patch else None
                if "lid" in patch:
                    set_lid.append((c_lid["jid"], lid))
        else:
            inserts.append({"jid": pn, "lid": lid, "phone": phone})

    # Projection: how many lid members become resolvable after the writes.
    proj_lid = dict(by_lid)
    for jid, lid in set_lid:
        proj_lid[lid] = {**by_jid[jid], "phone": by_jid[jid]["phone"] or dict(set_phone).get(jid)}
    for ins in inserts:
        proj_lid[ins["lid"]] = ins
    after = sum(1 for m in lid_members if (by_jid.get(m) or proj_lid.get(m) or {}).get("phone"))

    print(f"contacts: {len(contacts)} | lid-keyed members: {len(lid_members)}")
    print(f"members resolvable to a phone: before {before} → after {after}")
    print(f"writes planned: set lid on {len(set_lid)}, set phone on {len(set_phone)}, insert {len(inserts)} new contacts")

    if not args.apply:
        print("\nDRY RUN — nothing written. Re-run with --apply.")
        return 0

    for jid, lid in set_lid:
        rest("PATCH", f"wag_contacts?jid=eq.{urllib.parse.quote(jid)}", {"lid": lid}, prefer="return=minimal")
    for jid, phone in set_phone:
        rest("PATCH", f"wag_contacts?jid=eq.{urllib.parse.quote(jid)}", {"phone": phone}, prefer="return=minimal")
    for i in range(0, len(inserts), 200):
        rest("POST", "wag_contacts?on_conflict=jid", inserts[i:i + 200],
             prefer="resolution=merge-duplicates,return=minimal")
    print(f"✓ applied: {len(set_lid)} lid links, {len(set_phone)} phones, {len(inserts)} new contacts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
