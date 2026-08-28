"""IST-anchored period ranges — the Python twin of getPeriodDateRange
(performance-service) over the utils/ist.ts boundary math.

IST is a FIXED offset (UTC+5:30, no DST), so plain timedelta arithmetic is
exact. These boundaries must match the Node side to the second — the dashboards,
the Node brain, and this brain all describe "this week" identically or the
eval comparison (and worse, two users' numbers) silently diverge.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

IST = timedelta(hours=5, minutes=30)

PERIODS = ("today", "this_week", "this_month", "last_month")
OVERSIGHT_PERIODS = ("this_week", "this_month", "last_month")


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def ist_midnight(now: datetime) -> datetime:
    """The UTC instant of today's 00:00 IST."""
    ist_now = now.astimezone(timezone.utc) + IST
    floor = ist_now.replace(hour=0, minute=0, second=0, microsecond=0)
    return (floor - IST).replace(tzinfo=timezone.utc)


def period_range(period: str) -> tuple[str, str]:
    """→ (from_iso, to_iso), IST-anchored exactly like the Node resolver."""
    now = datetime.now(timezone.utc)
    if period == "today":
        return _iso(ist_midnight(now)), _iso(now)
    if period == "this_week":
        mid = ist_midnight(now)
        ist_wall = mid + IST
        monday = mid - timedelta(days=ist_wall.weekday())
        return _iso(monday), _iso(now)
    if period == "this_month":
        ist_wall = now + IST
        first = ist_wall.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return _iso((first - IST).replace(tzinfo=timezone.utc)), _iso(now)
    if period == "last_month":
        ist_wall = now + IST
        this_first = ist_wall.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        prev_last_day = this_first - timedelta(days=1)
        prev_first = prev_last_day.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return (
            _iso((prev_first - IST).replace(tzinfo=timezone.utc)),
            _iso((this_first - IST).replace(tzinfo=timezone.utc)),
        )
    return period_range("this_month")
