"""Chat backend: Anthropic agentic loop + query_data tool for the PT dashboard."""
from __future__ import annotations

import json
import os
import statistics
import time
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import anthropic

from db import get_db

BASE_DIR = Path(__file__).resolve().parent
CHAT_MODEL = os.environ.get("CHAT_MODEL", "claude-sonnet-4-6")

# Load system prompt once
_SYSTEM_PROMPT: str | None = None


def _get_system_prompt() -> str:
    global _SYSTEM_PROMPT
    # Always read fresh in case file was updated
    path = BASE_DIR / "CHATBOT_CONTEXT.md"
    _SYSTEM_PROMPT = path.read_text(encoding="utf-8")
    return _SYSTEM_PROMPT


# ── Session store (in-memory, last 10 messages per session) ──
_sessions: dict[str, list[dict]] = {}
_session_ts: dict[str, float] = {}
MAX_HISTORY = 20  # messages (10 turns)
SESSION_TTL = 3600  # 1 hour


def _get_history(session_id: str) -> list[dict]:
    now = time.time()
    # Evict stale sessions
    stale = [k for k, t in _session_ts.items() if now - t > SESSION_TTL]
    for k in stale:
        _sessions.pop(k, None)
        _session_ts.pop(k, None)
    _session_ts[session_id] = now
    return _sessions.setdefault(session_id, [])


def _trim_history(history: list[dict]) -> None:
    while len(history) > MAX_HISTORY:
        history.pop(0)


# ── Rate limiting ──
_rate: dict[str, list[float]] = {}
RATE_LIMIT = 30  # requests per minute


def _check_rate(ip: str) -> bool:
    now = time.time()
    times = _rate.setdefault(ip, [])
    times[:] = [t for t in times if now - t < 60]
    if len(times) >= RATE_LIMIT:
        return False
    times.append(now)
    return True


# ── query_data tool definition ──
QUERY_DATA_TOOL = {
    "name": "query_data",
    "description": (
        "Aggregate a metric from the PT conversation thread table. "
        "Returns JSON with value(s), numerator, denominator, and group breakdowns. "
        "Always use this tool to get numbers — never guess."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "metric": {
                "type": "string",
                "enum": [
                    "thread_count", "inbound_rate", "two_way_rate",
                    "reached_price_rate", "payment_link_rate", "booked_rate",
                    "dark_rate", "topic_prevalence", "conversion_lift",
                    "median_first_response_min", "p90_first_response_min",
                    "no_reply_rate",
                ],
                "description": "Which metric to compute.",
            },
            "filters": {
                "type": "object",
                "description": (
                    "Key-value filters applied before aggregation. "
                    "brand/country/workspace are strings; 0/1 flag columns are integers; "
                    "date_from/date_to are YYYY-MM-DD strings."
                ),
                "additionalProperties": True,
            },
            "group_by": {
                "type": "array",
                "items": {"type": "string", "enum": ["brand", "country", "workspace", "month"]},
                "description": "Optional grouping dimensions.",
            },
            "flag": {
                "type": "string",
                "description": "Column name for topic_prevalence or conversion_lift split.",
            },
        },
        "required": ["metric"],
    },
}

# ── Allowed filter / flag columns ──
TEXT_FILTERS = {"brand", "country", "workspace"}
DATE_FILTERS = {"date_from", "date_to"}
FLAG_COLUMNS = {
    "has_inbound", "agent_replied", "reached_link", "paylink_sent", "paylink_dark",
    "pricequote_sent", "pricequote_dark", "priceask", "askparent",
    "agentsched_sent", "agentsched_dark", "booked", "cust_paid", "agent_confirm",
    "obj_price", "ask_discount", "obj_think", "obj_busy", "obj_online",
    "trial_req", "tutor_qual", "entry_tpl",
    "cap_resched", "cap_avail", "cap_prog", "cap_cancel", "cap_rec",
    "parent_sig", "student_sig",
    "t_trial_offer", "t_trial_req", "t_trial_done", "t_exam", "t_price",
    "t_teacher", "t_competitor", "t_logistics", "t_social",
}


def _execute_query_data(params: dict) -> dict[str, Any]:
    """Run the query_data tool and return a JSON-serialisable result."""
    metric = params.get("metric")
    filters = params.get("filters") or {}
    group_by = params.get("group_by") or []
    flag = params.get("flag")

    # Validate metric
    VALID_METRICS = {
        "thread_count", "inbound_rate", "two_way_rate",
        "reached_price_rate", "payment_link_rate", "booked_rate",
        "dark_rate", "topic_prevalence", "conversion_lift",
        "median_first_response_min", "p90_first_response_min",
        "no_reply_rate",
    }
    if metric not in VALID_METRICS:
        return {"error": f"Unknown metric '{metric}'. Valid: {sorted(VALID_METRICS)}"}

    if metric in ("topic_prevalence", "conversion_lift", "dark_rate") and not flag:
        return {"error": f"metric '{metric}' requires a 'flag' parameter (column name)."}

    DARK_FLAGS = {"paylink_dark", "pricequote_dark", "agentsched_dark", "askparent_dark"}
    if metric == "dark_rate" and flag not in DARK_FLAGS:
        return {"error": f"dark_rate requires flag to be one of {sorted(DARK_FLAGS)}. Got '{flag}'."}

    if flag and flag not in FLAG_COLUMNS:
        return {"error": f"Unknown flag column '{flag}'. Valid: {sorted(FLAG_COLUMNS)}"}

    # Validate filters
    for k in filters:
        if k not in TEXT_FILTERS and k not in DATE_FILTERS and k not in FLAG_COLUMNS:
            return {"error": f"Unknown filter '{k}'. Valid text: {sorted(TEXT_FILTERS)}, date: {sorted(DATE_FILTERS)}, flags: {sorted(FLAG_COLUMNS)}"}

    # Build SQL
    clauses: list[str] = []
    sql_params: list = []
    for k, v in filters.items():
        if k in TEXT_FILTERS:
            clauses.append(f"{k} = ?")
            sql_params.append(str(v))
        elif k == "date_from":
            clauses.append("thread_date >= ?")
            sql_params.append(str(v))
        elif k == "date_to":
            clauses.append("thread_date <= ?")
            sql_params.append(str(v))
        elif k in FLAG_COLUMNS:
            clauses.append(f"{k} = ?")
            sql_params.append(int(v))

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    sql = f"SELECT * FROM threads{where}"

    db = get_db()
    try:
        rows = [dict(r) for r in db.execute(sql, sql_params).fetchall()]
    finally:
        db.close()

    if not rows:
        return {"error": "No data matches the given filters.", "n": 0}

    # Group if needed
    if group_by:
        groups = defaultdict(list)
        for r in rows:
            key_parts = []
            for g in group_by:
                if g == "month":
                    td = r.get("thread_date") or ""
                    key_parts.append(td[:7] if len(td) >= 7 else "unknown")
                else:
                    key_parts.append(str(r.get(g, "unknown")))
            groups[tuple(key_parts)].append(r)

        results = []
        for key_tuple, group_rows in sorted(groups.items()):
            label = dict(zip(group_by, key_tuple))
            val = _compute_metric(metric, group_rows, flag)
            val["group"] = label
            results.append(val)
        return {"results": results, "total_rows": len(rows)}
    else:
        result = _compute_metric(metric, rows, flag)
        result["total_rows"] = len(rows)
        return result


def _engaged(rows: list[dict]) -> list[dict]:
    return [r for r in rows if r.get("has_inbound") == 1
            and r.get("agent_replied") == 1 and (r.get("n_in") or 0) >= 2]


def _inbound(rows: list[dict]) -> list[dict]:
    return [r for r in rows if r.get("has_inbound") == 1]


def _compute_metric(metric: str, rows: list[dict], flag: str | None) -> dict:
    total = len(rows)
    inbound = _inbound(rows)
    engaged = _engaged(rows)
    eng_n = len(engaged)
    inb_n = len(inbound)

    if metric == "thread_count":
        return {"value": total, "n": total}

    if metric == "inbound_rate":
        val = round(inb_n / total * 100, 1) if total else 0
        return {"value": val, "numerator": inb_n, "denominator": total}

    if metric == "two_way_rate":
        val = round(eng_n / inb_n * 100, 1) if inb_n else 0
        return {"value": val, "numerator": eng_n, "denominator": inb_n,
                "note": "engaged / inbound"}

    if metric == "reached_price_rate":
        num = sum(1 for r in engaged if r.get("priceask") == 1 or r.get("pricequote_sent") == 1)
        val = round(num / eng_n * 100, 1) if eng_n else 0
        return {"value": val, "numerator": num, "denominator": eng_n,
                "note": "reached_price / engaged"}

    if metric == "payment_link_rate":
        num = sum(1 for r in engaged if r.get("paylink_sent") == 1)
        val = round(num / eng_n * 100, 1) if eng_n else 0
        return {"value": val, "numerator": num, "denominator": eng_n,
                "note": "paylink_sent / engaged"}

    if metric == "booked_rate":
        num = sum(1 for r in engaged if r.get("booked") == 1)
        val = round(num / eng_n * 100, 1) if eng_n else 0
        return {"value": val, "numerator": num, "denominator": eng_n,
                "note": "booked (proxy) / engaged"}

    if metric == "dark_rate":
        # Map dark flag to the event flag that must be 1
        event_map = {
            "paylink_dark": "paylink_sent",
            "pricequote_dark": "pricequote_sent",
            "agentsched_dark": "agentsched_sent",
            "askparent_dark": "askparent",
        }
        event_col = event_map[flag]
        # Denominator: rows where the event happened (flag is not NULL)
        event_rows = [r for r in rows if r.get(event_col) == 1]
        dark_rows = [r for r in event_rows if r.get(flag) == 1]
        continued_rows = [r for r in event_rows if r.get(flag) == 0]
        n_event = len(event_rows)
        n_dark = len(dark_rows)
        n_continued = len(continued_rows)
        dark_pct = round(n_dark / n_event * 100, 1) if n_event else 0
        cont_pct = round(n_continued / n_event * 100, 1) if n_event else 0
        return {
            "dark_pct": dark_pct, "continued_pct": cont_pct,
            "dark": n_dark, "continued": n_continued, "event_total": n_event,
            "flag": flag, "event": event_col,
            "note": f"{n_dark} went dark out of {n_event} who got {event_col}",
        }

    if metric == "topic_prevalence":
        num = sum(1 for r in engaged if r.get(flag) == 1)
        val = round(num / eng_n * 100, 1) if eng_n else 0
        return {"value": val, "numerator": num, "denominator": eng_n,
                "flag": flag, "note": f"% of engaged with {flag}=1"}

    if metric == "conversion_lift":
        with_flag = [r for r in engaged if r.get(flag) == 1]
        without_flag = [r for r in engaged if r.get(flag) != 1]
        n_with = len(with_flag)
        n_without = len(without_flag)
        bk_with = sum(1 for r in with_flag if r.get("booked") == 1)
        bk_without = sum(1 for r in without_flag if r.get("booked") == 1)
        rate_with = round(bk_with / n_with * 100, 1) if n_with else 0
        rate_without = round(bk_without / n_without * 100, 1) if n_without else 0
        lift = round(rate_with / rate_without, 1) if rate_without > 0 else None
        return {
            "with_flag": {"rate": rate_with, "booked": bk_with, "n": n_with},
            "without_flag": {"rate": rate_without, "booked": bk_without, "n": n_without},
            "lift": lift,
            "flag": flag,
        }

    if metric == "median_first_response_min":
        vals = [float(r["first_resp_sec"]) / 60.0 for r in rows
                if r.get("first_resp_sec") is not None and r["first_resp_sec"] != ""]
        if not vals:
            return {"value": None, "n": 0}
        return {"value": round(statistics.median(vals), 1), "n": len(vals)}

    if metric == "p90_first_response_min":
        vals = sorted(float(r["first_resp_sec"]) / 60.0 for r in rows
                      if r.get("first_resp_sec") is not None and r["first_resp_sec"] != "")
        if not vals:
            return {"value": None, "n": 0}
        idx = int(len(vals) * 0.9)
        return {"value": round(vals[idx], 1), "n": len(vals)}

    if metric == "no_reply_rate":
        noreply = sum(1 for r in inbound if r.get("agent_replied") == 0)
        val = round(noreply / inb_n * 100, 1) if inb_n else 0
        return {"value": val, "numerator": noreply, "denominator": inb_n,
                "note": "no-reply / inbound"}

    return {"error": f"Unhandled metric: {metric}"}


# ── Agentic chat loop ──
MAX_TOOL_ITERATIONS = 3  # keep low for speed on free tier


def run_chat(session_id: str, user_message: str) -> str:
    """Run the agentic loop and return the final assistant text."""
    client = anthropic.Anthropic(timeout=25.0)  # hard timeout per API call

    history = _get_history(session_id)
    history.append({"role": "user", "content": user_message})
    _trim_history(history)

    messages = list(history)
    system = _get_system_prompt()

    for _ in range(MAX_TOOL_ITERATIONS):
        resp = client.messages.create(
            model=CHAT_MODEL,
            max_tokens=1024,
            system=system,
            tools=[QUERY_DATA_TOOL],
            messages=messages,
        )

        # Check if there's a tool use
        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        text_parts = [b.text for b in resp.content if b.type == "text"]

        if not tool_uses:
            # Final answer
            final_text = "\n".join(text_parts)
            history.append({"role": "assistant", "content": final_text})
            _trim_history(history)
            return final_text

        # Process tool calls
        messages.append({"role": "assistant", "content": resp.content})

        tool_results = []
        for tu in tool_uses:
            if tu.name == "query_data":
                result = _execute_query_data(tu.input)
            else:
                result = {"error": f"Unknown tool: {tu.name}"}
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": tu.id,
                "content": json.dumps(result),
            })
        messages.append({"role": "user", "content": tool_results})

    # Exhausted iterations
    final = "I ran out of computation steps. Could you narrow the question?"
    history.append({"role": "assistant", "content": final})
    return final
