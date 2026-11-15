from datetime import datetime, timedelta

IST_OFFSET = timedelta(hours=5, minutes=30)


def ist_now():
    """Current datetime in IST (naive, for display/default generation)."""
    return datetime.utcnow() + IST_OFFSET


def ist_today():
    """Today's date string in IST (YYYY-MM-DD)."""
    return ist_now().strftime('%Y-%m-%d')


def ist_days_ago(n):
    """Date string n days ago in IST (YYYY-MM-DD)."""
    return (ist_now() - timedelta(days=n)).strftime('%Y-%m-%d')


def parse_ist_date(date_str):
    """Parse an IST date string (YYYY-MM-DD) → naive UTC datetime at IST midnight.

    E.g. '2026-11-12' (IST 00:00) = '2026-11-11 18:30:00' UTC
    """
    return datetime.strptime(date_str, '%Y-%m-%d') - IST_OFFSET


def parse_ist_date_end(date_str):
    """Parse an IST date string → naive UTC datetime at the END of that IST day.

    E.g. '2026-11-12' end = '2026-11-12 18:30:00' UTC (= 2026-11-13 00:00 IST)
    """
    return datetime.strptime(date_str, '%Y-%m-%d') + timedelta(days=1) - IST_OFFSET
