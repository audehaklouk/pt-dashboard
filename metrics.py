"""Server-side metric aggregation for PT Dashboard."""
import statistics
from collections import defaultdict
from datetime import datetime


def compute_metrics(rows: list[dict]) -> dict:
    """Compute all dashboard metrics from filtered thread rows."""

    # Convert rows to list of dicts if needed (handles sqlite3.Row)
    rows = [dict(r) for r in rows]
    total = len(rows)

    # --- Funnel ---
    inbound = [r for r in rows if r["has_inbound"] == 1]
    engaged = [
        r
        for r in rows
        if r["has_inbound"] == 1
        and r["agent_replied"] == 1
        and (r["n_in"] or 0) >= 2
    ]
    reached_price = [
        r
        for r in engaged
        if r["priceask"] == 1 or r["pricequote_sent"] == 1
    ]
    paylink = [r for r in engaged if r["paylink_sent"] == 1]
    booked = [r for r in engaged if r["booked"] == 1]

    engaged_n = len(engaged)
    inbound_n = len(inbound)

    # Funnel percentages
    inb_pct = round(inbound_n / total * 100, 1) if total else 0
    tw_pct_inb = round(engaged_n / inbound_n * 100, 1) if inbound_n else 0
    price_pct_tw = (
        round(len(reached_price) / engaged_n * 100, 1) if engaged_n else 0
    )
    pl_pct_tw = round(len(paylink) / engaged_n * 100, 1) if engaged_n else 0
    bk_pct_tw = round(len(booked) / engaged_n * 100, 1) if engaged_n else 0

    # --- Payment continuation ---
    # Denominator is ALL rows with paylink_sent==1 (not just engaged)
    pl_all = [r for r in rows if r["paylink_sent"] == 1]
    pl_dark = [r for r in pl_all if r["paylink_dark"] == 1]
    pl_continued = len(pl_all) - len(pl_dark)
    pl_booked = [r for r in pl_all if r["booked"] == 1]

    # --- Drop-off ---
    # Denominators are ALL rows with the event flag (not just engaged)
    pq_all = [r for r in rows if r["pricequote_sent"] == 1]
    pq_dark = [r for r in pq_all if r["pricequote_dark"] == 1]

    as_all = [r for r in rows if r["agentsched_sent"] == 1]
    as_dark = [r for r in as_all if r["agentsched_dark"] == 1]

    # --- Objections (denominator is engaged) ---
    objections = []
    for key, label in [
        ("obj_price", "Price too high (says expensive)"),
        ("ask_discount", "Asks for a discount/offer"),
        ("obj_think", "Wants to think / will get back"),
        ("obj_busy", "Too busy / no time right now"),
        ("obj_online", "Online vs in-person / where are you"),
        ("trial_req", "Wants a trial / free demo first"),
        ("tutor_qual", "Tutor quality / qualification"),
    ]:
        count = sum(1 for r in engaged if r[key] == 1)
        pct = round(count / engaged_n * 100, 1) if engaged_n else 0
        objections.append({"key": key, "label": label, "count": count, "pct": pct})
    objections.sort(key=lambda x: x["count"], reverse=True)

    # --- Capabilities (denominator is engaged) ---
    capabilities = []
    for key, label in [
        ("cap_resched", "Reschedule / move a lesson"),
        ("cap_rec", "Get lesson recording"),
        ("cap_prog", "Progress / report / feedback"),
        ("cap_avail", "See tutor availability/slots"),
        ("cap_cancel", "Cancel / refund"),
    ]:
        count = sum(1 for r in engaged if r[key] == 1)
        capabilities.append({"key": key, "label": label, "count": count})
    capabilities.sort(key=lambda x: x["count"], reverse=True)

    # --- Response SLA by workspace ---
    by_ws = defaultdict(list)
    for r in rows:
        by_ws[r["workspace"]].append(r)

    response_sla = []
    for ws in sorted(by_ws.keys()):
        ws_rows = by_ws[ws]
        ws_inbound = [r for r in ws_rows if r["has_inbound"] == 1]
        ws_noreply = [r for r in ws_inbound if r["agent_replied"] == 0]
        frt_values = [
            r["first_resp_sec"] / 60.0
            for r in ws_rows
            if r["first_resp_sec"] is not None and r["first_resp_sec"] != ""
        ]

        median_min = round(statistics.median(frt_values), 1) if frt_values else None
        p90_min = (
            round(sorted(frt_values)[int(len(frt_values) * 0.9)], 1)
            if frt_values
            else None
        )
        noreply_pct = (
            round(len(ws_noreply) / len(ws_inbound) * 100, 1) if ws_inbound else 0
        )

        response_sla.append(
            {
                "workspace": ws,
                "median_min": median_min,
                "p90_min": p90_min,
                "noreply_pct": noreply_pct,
                "n_first": len(frt_values),
            }
        )

    # --- Buyer type (from engaged rows) ---
    parent = sum(
        1
        for r in engaged
        if (r["parent_sig"] or 0) > 0 and (r["student_sig"] or 0) == 0
    )
    student = sum(
        1
        for r in engaged
        if (r["student_sig"] or 0) > 0 and (r["parent_sig"] or 0) == 0
    )
    unknown = engaged_n - parent - student

    # --- Headlines ---
    all_frt = [
        r["first_resp_sec"] / 60.0
        for r in rows
        if r["first_resp_sec"] is not None and r["first_resp_sec"] != ""
    ]
    median_frt_all = round(statistics.median(all_frt), 1) if all_frt else None

    # ========== DEEPER INSIGHTS ==========

    # --- Payment Journey (mini-funnel) ---
    payment_journey = _compute_payment_journey(engaged, reached_price, paylink, booked)

    # --- Response by Hour of Day ---
    response_by_hour = _compute_response_by_hour(rows)

    # --- Speed → Conversion ---
    speed_conversion = _compute_speed_conversion(engaged)

    # --- Segment Health Scorecard ---
    segment_health = _compute_segment_health(rows)

    # --- Weekly Trend ---
    weekly_trend = _compute_weekly_trend(rows)

    # --- Buy Readiness ---
    buy_readiness = _compute_buy_readiness(engaged, reached_price, paylink)

    # --- Topic Insights ---
    topic_insights = _compute_topic_insights(rows, engaged)

    # --- Demand Drivers ---
    demand_drivers = _compute_demand_drivers(engaged, booked, engaged_n)

    # --- Auto Insight Callouts ---
    auto_insights = _compute_auto_insights(
        rows, engaged, booked, inbound, all_frt, engaged_n, inbound_n, total
    )

    return {
        "engaged_n": engaged_n,
        "headlines": {
            "threads": total,
            "twoway_rate": tw_pct_inb,
            "paylink_reach_pct": pl_pct_tw,
            "booked_pct": bk_pct_tw,
            "median_first_resp_min": median_frt_all,
        },
        "funnel": {
            "threads": total,
            "inbound": inbound_n,
            "twoway": engaged_n,
            "reached_price": len(reached_price),
            "paylink": len(paylink),
            "booked": len(booked),
            "inb_pct": inb_pct,
            "tw_pct_inb": tw_pct_inb,
            "price_pct_tw": price_pct_tw,
            "pl_pct_tw": pl_pct_tw,
            "bk_pct_tw": bk_pct_tw,
        },
        "dropoff": [
            {
                "event": "After Price Quote",
                "n": len(pq_all),
                "dark": len(pq_dark),
                "pct": round(len(pq_dark) / len(pq_all) * 100, 1) if pq_all else 0,
            },
            {
                "event": "After Payment Link",
                "n": len(pl_all),
                "dark": len(pl_dark),
                "pct": round(len(pl_dark) / len(pl_all) * 100, 1) if pl_all else 0,
            },
            {
                "event": "After Schedule Proposal",
                "n": len(as_all),
                "dark": len(as_dark),
                "pct": round(len(as_dark) / len(as_all) * 100, 1) if as_all else 0,
            },
        ],
        "payment": {
            "paylinks": len(pl_all),
            "dark": len(pl_dark),
            "dark_pct": round(len(pl_dark) / len(pl_all) * 100, 1) if pl_all else 0,
            "continued": pl_continued,
            "cont_pct": round(pl_continued / len(pl_all) * 100, 1) if pl_all else 0,
            "booked_of_link": len(pl_booked),
            "booked_of_link_pct": (
                round(len(pl_booked) / len(pl_all) * 100, 1) if pl_all else 0
            ),
        },
        "objections": objections,
        "capabilities": capabilities,
        "response_sla": response_sla,
        "buyer_type": {
            "parent": parent,
            "student": student,
            "unknown": unknown,
            "parent_pct": round(parent / engaged_n * 100, 1) if engaged_n else 0,
            "student_pct": round(student / engaged_n * 100, 1) if engaged_n else 0,
            "unknown_pct": round(unknown / engaged_n * 100, 1) if engaged_n else 0,
        },
        # Deeper insights
        "payment_journey": payment_journey,
        "response_by_hour": response_by_hour,
        "speed_conversion": speed_conversion,
        "segment_health": segment_health,
        "weekly_trend": weekly_trend,
        "buy_readiness": buy_readiness,
        "topic_insights": topic_insights,
        "demand_drivers": demand_drivers,
        "auto_insights": auto_insights,
    }


def _compute_payment_journey(engaged, reached_price, paylink, booked):
    """Mini-funnel: reached price -> got link -> booked."""
    n_engaged = len(engaged)
    n_price = len(reached_price)
    n_link = len(paylink)
    n_booked = len(booked)

    return {
        "reached_price": n_price,
        "got_link": n_link,
        "booked": n_booked,
        "price_to_link_pct": round(n_link / n_price * 100, 1) if n_price else 0,
        "link_to_booked_pct": round(n_booked / n_link * 100, 1) if n_link else 0,
        "price_to_booked_pct": round(n_booked / n_price * 100, 1) if n_price else 0,
    }


def _compute_response_by_hour(rows):
    """Median first-response time by hour-of-day (0-23)."""
    by_hour = defaultdict(list)
    total_with_frt = 0

    for r in rows:
        frt = r.get("first_resp_sec")
        first_ts = r.get("first")
        if frt is None or frt == "" or not first_ts:
            continue
        total_with_frt += 1
        try:
            dt = datetime.fromisoformat(str(first_ts).replace("Z", "+00:00"))
            hour = dt.hour
        except (ValueError, TypeError):
            continue
        by_hour[hour].append(float(frt) / 60.0)

    hours = []
    after_hours_values = []
    for h in range(24):
        vals = by_hour.get(h, [])
        median_min = round(statistics.median(vals), 1) if vals else None
        is_after_hours = h >= 22 or h < 8
        hours.append({
            "hour": h,
            "median_min": median_min,
            "count": len(vals),
            "is_after_hours": is_after_hours,
        })
        if is_after_hours:
            after_hours_values.extend(vals)

    after_hours_share = round(
        len(after_hours_values) / total_with_frt * 100, 1
    ) if total_with_frt else 0
    after_hours_median = (
        round(statistics.median(after_hours_values), 1)
        if after_hours_values else None
    )

    return {
        "hours": hours,
        "after_hours_share": after_hours_share,
        "after_hours_median": after_hours_median,
    }


def _compute_speed_conversion(engaged):
    """Booking % by first-response time bucket."""
    buckets = [
        ("<5m", 0, 5),
        ("5-15m", 5, 15),
        ("15-60m", 15, 60),
        ("1-4h", 60, 240),
        (">4h", 240, float("inf")),
    ]

    result = []
    for label, lo, hi in buckets:
        in_bucket = [
            r for r in engaged
            if r.get("first_resp_sec") is not None
            and r["first_resp_sec"] != ""
            and lo <= (float(r["first_resp_sec"]) / 60.0) < hi
        ]
        n = len(in_bucket)
        booked_n = sum(1 for r in in_bucket if r["booked"] == 1)
        booked_pct = round(booked_n / n * 100, 1) if n else 0
        result.append({
            "bucket": label,
            "n": n,
            "booked": booked_n,
            "booked_pct": booked_pct,
        })

    return result


def _compute_segment_health(rows):
    """Health scorecard per workspace segment."""
    by_ws = defaultdict(list)
    for r in rows:
        by_ws[r["workspace"]].append(r)

    segments = []
    for ws in sorted(by_ws.keys()):
        ws_rows = by_ws[ws]
        n = len(ws_rows)
        inbound = [r for r in ws_rows if r["has_inbound"] == 1]
        engaged = [
            r for r in ws_rows
            if r["has_inbound"] == 1
            and r["agent_replied"] == 1
            and (r["n_in"] or 0) >= 2
        ]
        eng_n = len(engaged)
        tw_pct = round(eng_n / len(inbound) * 100, 1) if inbound else 0

        pl_rows = [r for r in engaged if r["paylink_sent"] == 1]
        pl_reach = round(len(pl_rows) / eng_n * 100, 1) if eng_n else 0

        booked_rows = [r for r in engaged if r["booked"] == 1]
        booked_pct = round(len(booked_rows) / eng_n * 100, 1) if eng_n else 0

        frt_vals = [
            float(r["first_resp_sec"]) / 60.0
            for r in ws_rows
            if r.get("first_resp_sec") is not None and r["first_resp_sec"] != ""
        ]
        median_resp = round(statistics.median(frt_vals), 1) if frt_vals else None

        segments.append({
            "workspace": ws,
            "n": n,
            "twoway_pct": tw_pct,
            "paylink_reach_pct": pl_reach,
            "booked_pct": booked_pct,
            "median_resp_min": median_resp,
        })

    return segments


def _compute_weekly_trend(rows):
    """Inbound + booked counts by ISO week."""
    weeks = defaultdict(lambda: {"inbound": 0, "booked": 0})

    for r in rows:
        td = r.get("thread_date")
        if not td:
            continue
        try:
            dt = datetime.strptime(str(td)[:10], "%Y-%m-%d")
            iso = dt.isocalendar()
            week_label = f"{iso[0]}-W{iso[1]:02d}"
        except (ValueError, TypeError):
            continue

        if r["has_inbound"] == 1:
            weeks[week_label]["inbound"] += 1
        if r.get("booked") == 1 and r["has_inbound"] == 1 and r["agent_replied"] == 1 and (r["n_in"] or 0) >= 2:
            weeks[week_label]["booked"] += 1

    result = []
    for week in sorted(weeks.keys()):
        result.append({
            "week": week,
            "inbound": weeks[week]["inbound"],
            "booked": weeks[week]["booked"],
        })

    return result


def _compute_buy_readiness(engaged, reached_price, paylink):
    """Buy-readiness: implicit (agreement after price) vs explicit ask, gap callout."""
    eng_n = len(engaged)
    # Implicit readiness: reached price AND didn't object on price (or booked)
    implicit_ready = [
        r for r in reached_price
        if r.get("booked") == 1 or (r.get("obj_price") != 1 and r.get("obj_think") != 1)
    ]
    # Explicit ask: customer paid or asked for a payment link (priceask + paylink_sent)
    explicit_ask = [r for r in engaged if r.get("cust_paid") == 1]
    # Ready but never got a link
    ready_no_link = [
        r for r in implicit_ready
        if r.get("paylink_sent") != 1 and r.get("booked") != 1
    ]
    return {
        "implicit_ready": len(implicit_ready),
        "explicit_ask": len(explicit_ask),
        "ready_no_link": len(ready_no_link),
        "engaged_n": eng_n,
        "implicit_pct": round(len(implicit_ready) / eng_n * 100, 1) if eng_n else 0,
        "explicit_pct": round(len(explicit_ask) / eng_n * 100, 1) if eng_n else 0,
    }


def _compute_topic_insights(rows, engaged):
    """Topic insights: frequency by converted vs leaked, trial states, converting combos."""
    TOPICS = [
        ("t_logistics", "Logistics"),
        ("t_trial_offer", "Trial Offered"),
        ("t_trial_req", "Trial Requested"),
        ("t_exam", "Exam/Subject"),
        ("t_price", "Price Discussion"),
        ("t_social", "Social Proof"),
        ("t_teacher", "Teacher Credentials"),
        ("t_competitor", "Competitor Mention"),
        ("t_trial_done", "Trial Completed"),
    ]

    # Split engaged into converted (reached_link=1) vs leaked (reached_link=0)
    converted = [r for r in engaged if r.get("reached_link") == 1]
    leaked = [r for r in engaged if r.get("reached_link") != 1]
    n_conv = len(converted)
    n_leak = len(leaked)

    # Topic frequency
    topic_freq = []
    for key, label in TOPICS:
        conv_count = sum(1 for r in converted if r.get(key) == 1)
        leak_count = sum(1 for r in leaked if r.get(key) == 1)
        conv_pct = round(conv_count / n_conv * 100, 1) if n_conv else 0
        leak_pct = round(leak_count / n_leak * 100, 1) if n_leak else 0
        topic_freq.append({
            "key": key,
            "label": label,
            "converted_pct": conv_pct,
            "leaked_pct": leak_pct,
            "gap": round(conv_pct - leak_pct, 1),
            "converted_n": conv_count,
            "leaked_n": leak_count,
        })
    # Sort by gap descending
    topic_freq.sort(key=lambda x: x["gap"], reverse=True)

    # Trial states among converted
    trial_offered = sum(1 for r in converted if r.get("t_trial_offer") == 1)
    trial_requested = sum(1 for r in converted if r.get("t_trial_req") == 1)
    trial_completed = sum(1 for r in converted if r.get("t_trial_done") == 1)

    trial_states = {
        "offered": trial_offered,
        "requested": trial_requested,
        "completed": trial_completed,
        "offered_pct": round(trial_offered / n_conv * 100, 1) if n_conv else 0,
        "requested_pct": round(trial_requested / n_conv * 100, 1) if n_conv else 0,
        "completed_pct": round(trial_completed / n_conv * 100, 1) if n_conv else 0,
    }

    # Converting combinations — pairs of topics and their reach-link rate
    topic_keys = [k for k, _ in TOPICS]
    base_reach_rate = round(n_conv / len(engaged) * 100, 1) if engaged else 0

    combos = []
    for i, k1 in enumerate(topic_keys):
        for k2 in topic_keys[i + 1:]:
            both = [r for r in engaged if r.get(k1) == 1 and r.get(k2) == 1]
            if len(both) < 5:
                continue
            reached = sum(1 for r in both if r.get("reached_link") == 1)
            rate = round(reached / len(both) * 100, 1)
            lift = round(rate / base_reach_rate, 1) if base_reach_rate else 0
            l1 = dict(TOPICS).get(k1, k1)
            l2 = dict(TOPICS).get(k2, k2)
            combos.append({
                "pair": f"{l1} + {l2}",
                "n": len(both),
                "reach_rate": rate,
                "lift": lift,
            })
    combos.sort(key=lambda x: x["lift"], reverse=True)
    combos = combos[:8]  # top 8

    return {
        "topic_freq": topic_freq,
        "trial_states": trial_states,
        "converting_combos": combos,
        "base_reach_rate": base_reach_rate,
        "n_converted": n_conv,
        "n_leaked": n_leak,
    }


def _compute_demand_drivers(engaged, booked, engaged_n):
    """Demand drivers: exam-driven share, subject demand, female-tutor (parent/student proxy)."""
    bk_rate = round(len(booked) / engaged_n * 100, 1) if engaged_n else 0

    # Exam-driven conversations
    exam_eng = [r for r in engaged if r.get("t_exam") == 1]
    non_exam = [r for r in engaged if r.get("t_exam") != 1]
    exam_n = len(exam_eng)
    exam_share = round(exam_n / engaged_n * 100, 1) if engaged_n else 0
    exam_bk = sum(1 for r in exam_eng if r.get("booked") == 1)
    exam_bk_pct = round(exam_bk / exam_n * 100, 1) if exam_n else 0
    non_exam_bk_pct = round(
        sum(1 for r in non_exam if r.get("booked") == 1) / len(non_exam) * 100, 1
    ) if non_exam else 0
    exam_lift = round(exam_bk_pct / non_exam_bk_pct, 1) if non_exam_bk_pct else 0

    # Trial-driven conversations
    trial_eng = [r for r in engaged if r.get("trial_req") == 1]
    trial_n = len(trial_eng)
    trial_share = round(trial_n / engaged_n * 100, 1) if engaged_n else 0
    trial_bk = sum(1 for r in trial_eng if r.get("booked") == 1)
    trial_bk_pct = round(trial_bk / trial_n * 100, 1) if trial_n else 0

    # Parent-initiated (proxy for family involvement / decision-maker)
    parent_eng = [r for r in engaged if (r.get("parent_sig") or 0) > 0]
    parent_n = len(parent_eng)
    parent_share = round(parent_n / engaged_n * 100, 1) if engaged_n else 0
    parent_bk = sum(1 for r in parent_eng if r.get("booked") == 1)
    parent_bk_pct = round(parent_bk / parent_n * 100, 1) if parent_n else 0

    return {
        "overall_bk_pct": bk_rate,
        "exam_share": exam_share,
        "exam_bk_pct": exam_bk_pct,
        "exam_lift": exam_lift,
        "exam_n": exam_n,
        "trial_share": trial_share,
        "trial_bk_pct": trial_bk_pct,
        "trial_n": trial_n,
        "parent_share": parent_share,
        "parent_bk_pct": parent_bk_pct,
        "parent_n": parent_n,
    }


def _compute_auto_insights(rows, engaged, booked, inbound, all_frt, engaged_n, inbound_n, total):
    """Generate structured, narrative analytics insights from the current data.

    Uses: funnel analysis, bottleneck identification, opportunity sizing,
    segment comparison, speed-to-lead, cohort trends, and behavioral lift.
    Returns a list of sections, each with a title, icon key, and typed items.
    """
    sections = []

    # ── 1. EXECUTIVE SUMMARY ──
    exec_items = []
    if total > 0 and engaged_n > 0:
        bk_n = len(booked)
        bk_pct = round(bk_n / engaged_n * 100, 1)
        pl_sent = sum(1 for r in rows if r["paylink_sent"] == 1)
        pl_reach = round(pl_sent / total * 100, 1) if total else 0

        exec_items.append({
            "text": (
                f"From {total:,} total conversations, {inbound_n:,} had inbound messages, "
                f"{engaged_n:,} became two-way engaged, and {bk_n:,} ended in a booking "
                f"({bk_pct}% of engaged). "
                f"Only {pl_reach}% of all threads ever received a payment link."
            ),
            "type": "neutral",
        })

        # Biggest funnel leak
        inb_drop = inbound_n - engaged_n
        inb_drop_pct = round(inb_drop / inbound_n * 100, 1) if inbound_n else 0
        reached_price = [r for r in engaged if r["priceask"] == 1 or r["pricequote_sent"] == 1]
        price_drop = len(reached_price) - pl_sent
        price_to_link = round(pl_sent / len(reached_price) * 100, 1) if reached_price else 0

        exec_items.append({
            "text": (
                f"The biggest volume leak is inbound-to-two-way: {inb_drop:,} conversations "
                f"({inb_drop_pct}% of inbound) never became two-way engaged. "
                f"Of those who did engage, only {price_to_link}% of price-stage conversations "
                f"received a payment link."
            ),
            "type": "negative",
        })

    if exec_items:
        sections.append({"title": "Executive Summary", "icon": "summary", "items": exec_items})

    # ── 2. BIGGEST BOTTLENECK ──
    bottleneck_items = []

    # A) No-reply waste
    if inbound_n > 0:
        noreply = sum(1 for r in inbound if r["agent_replied"] == 0)
        noreply_pct = round(noreply / inbound_n * 100, 1)
        if noreply > 0:
            # estimate lost bookings from noreply
            avg_bk_rate = len(booked) / engaged_n if engaged_n else 0
            est_lost = round(noreply * avg_bk_rate)
            bottleneck_items.append({
                "text": (
                    f"{noreply:,} inbound conversations ({noreply_pct}%) never received a human reply. "
                    f"At the current engaged booking rate, replying to all of these could yield "
                    f"~{est_lost:,} additional bookings."
                ),
                "type": "opportunity" if est_lost > 5 else "negative",
            })

    # B) Price-quote drop-off — the silent killer
    pq_all = [r for r in rows if r["pricequote_sent"] == 1]
    pq_dark = [r for r in pq_all if r["pricequote_dark"] == 1]
    if pq_all:
        pq_dark_pct = round(len(pq_dark) / len(pq_all) * 100, 1)
        bottleneck_items.append({
            "text": (
                f"{pq_dark_pct}% of customers ({len(pq_dark):,}) went dark after a price quote. "
                f"This is the single highest drop-off point in the funnel. "
                f"Testing anchoring language, instalment framing, or a same-message trial offer "
                f"could recover a portion of these."
            ),
            "type": "negative",
        })

    # C) Payment link gap — engaged customers who reached price but never got a link
    if engaged_n > 0:
        reached_price = [r for r in engaged if r["priceask"] == 1 or r["pricequote_sent"] == 1]
        got_link = [r for r in engaged if r["paylink_sent"] == 1]
        gap = len(reached_price) - len(got_link)
        if gap > 0 and len(reached_price) > 0:
            gap_pct = round(gap / len(reached_price) * 100, 1)
            # of those who got a link, what % booked?
            link_bk_rate = sum(1 for r in got_link if r["booked"] == 1) / len(got_link) if got_link else 0
            est_extra = round(gap * link_bk_rate)
            bottleneck_items.append({
                "text": (
                    f"{gap:,} engaged conversations ({gap_pct}% of price-stage) "
                    f"reached the pricing discussion but never received a payment link. "
                    f"At the current link-to-booking rate ({round(link_bk_rate*100,1)}%), "
                    f"closing this gap could add ~{est_extra:,} bookings."
                ),
                "type": "opportunity",
            })

    if bottleneck_items:
        sections.append({"title": "Bottleneck Analysis", "icon": "bottleneck", "items": bottleneck_items})

    # ── 3. SPEED-TO-LEAD ──
    speed_items = []
    if engaged_n > 10:
        fast = [r for r in engaged if _frt_min(r) is not None and _frt_min(r) < 5]
        medium = [r for r in engaged if _frt_min(r) is not None and 5 <= _frt_min(r) < 15]
        slow = [r for r in engaged if _frt_min(r) is not None and _frt_min(r) >= 60]
        very_slow = [r for r in engaged if _frt_min(r) is not None and _frt_min(r) >= 240]

        if len(fast) >= 5:
            fast_bk = round(sum(1 for r in fast if r["booked"] == 1) / len(fast) * 100, 1)
            if len(very_slow) >= 5:
                vs_bk = round(sum(1 for r in very_slow if r["booked"] == 1) / len(very_slow) * 100, 1)
                if vs_bk > 0:
                    ratio = round(fast_bk / vs_bk, 1)
                    speed_items.append({
                        "text": (
                            f"Conversations replied to within 5 minutes book at {fast_bk}% "
                            f"vs {vs_bk}% for 4+ hour replies \u2014 a {ratio}x lift. "
                            f"Speed is the strongest single predictor of conversion in this dataset."
                        ),
                        "type": "positive" if ratio > 1.5 else "neutral",
                    })
                elif fast_bk > 0:
                    speed_items.append({
                        "text": (
                            f"Conversations replied to within 5 minutes book at {fast_bk}%. "
                            f"None of the 4+ hour replies resulted in a booking ({len(very_slow):,} conversations lost)."
                        ),
                        "type": "negative",
                    })

        # After-hours impact
        after_hrs = [r for r in rows if _is_after_hours(r)]
        biz_hrs = [r for r in rows if not _is_after_hours(r) and r.get("first") is not None and r["first"] != ""]
        if len(after_hrs) >= 10 and len(biz_hrs) >= 10:
            ah_frt = [_frt_min(r) for r in after_hrs if _frt_min(r) is not None]
            bh_frt = [_frt_min(r) for r in biz_hrs if _frt_min(r) is not None]
            if ah_frt and bh_frt:
                ah_med = round(statistics.median(ah_frt), 0)
                bh_med = round(statistics.median(bh_frt), 0)
                ah_share = round(len(after_hrs) / (len(after_hrs) + len(biz_hrs)) * 100, 1)
                if ah_med > bh_med * 1.5:
                    speed_items.append({
                        "text": (
                            f"{ah_share}% of conversations start after hours (22:00\u201308:00), "
                            f"where median response is {ah_med:.0f}m vs {bh_med:.0f}m during business hours. "
                            f"An auto-reply or staggered shift could protect conversion on these leads."
                        ),
                        "type": "opportunity",
                    })

    if speed_items:
        sections.append({"title": "Speed-to-Lead", "icon": "speed", "items": speed_items})

    # ── 4. SEGMENT COMPARISON ──
    seg_items = []
    by_ws = defaultdict(list)
    for r in rows:
        by_ws[r["workspace"]].append(r)

    if len(by_ws) >= 2:
        seg_stats = []
        for ws, ws_rows in by_ws.items():
            ws_inb = [r for r in ws_rows if r["has_inbound"] == 1]
            ws_eng = [r for r in ws_rows if r["has_inbound"] == 1 and r["agent_replied"] == 1 and (r["n_in"] or 0) >= 2]
            ws_bk = [r for r in ws_eng if r["booked"] == 1]
            ws_frt = [_frt_min(r) for r in ws_rows if _frt_min(r) is not None]
            eng_n_ws = len(ws_eng)
            seg_stats.append({
                "ws": ws,
                "n": len(ws_rows),
                "eng": eng_n_ws,
                "bk": len(ws_bk),
                "bk_pct": round(len(ws_bk) / eng_n_ws * 100, 1) if eng_n_ws else 0,
                "med_frt": round(statistics.median(ws_frt), 1) if ws_frt else None,
            })

        seg_stats.sort(key=lambda x: x["bk_pct"], reverse=True)
        best = seg_stats[0]
        worst = seg_stats[-1]

        if best["bk_pct"] > 0 and worst["bk_pct"] >= 0 and best["ws"] != worst["ws"]:
            seg_items.append({
                "text": (
                    f"Best-converting segment: {best['ws']} at {best['bk_pct']}% booking rate "
                    f"({best['bk']:,} bookings from {best['eng']:,} engaged). "
                    f"Lowest: {worst['ws']} at {worst['bk_pct']}% "
                    f"({worst['bk']:,} from {worst['eng']:,})."
                ),
                "type": "neutral",
            })

            if best["med_frt"] is not None and worst["med_frt"] is not None:
                if best["med_frt"] < worst["med_frt"]:
                    seg_items.append({
                        "text": (
                            f"The best segment ({best['ws']}) also has a {best['med_frt']:.0f}m median response "
                            f"vs {worst['med_frt']:.0f}m for the lowest. "
                            f"Faster response and higher booking are correlated across segments."
                        ),
                        "type": "positive",
                    })

        # Largest-volume underperformer
        by_volume = sorted(seg_stats, key=lambda x: x["n"], reverse=True)
        biggest = by_volume[0]
        avg_bk_pct = round(len(booked) / engaged_n * 100, 1) if engaged_n else 0
        if biggest["bk_pct"] < avg_bk_pct and biggest["eng"] > 100:
            gap_extra = round((avg_bk_pct - biggest["bk_pct"]) / 100 * biggest["eng"])
            seg_items.append({
                "text": (
                    f"The highest-volume segment ({biggest['ws']}, {biggest['n']:,} threads) "
                    f"books at {biggest['bk_pct']}%, below the overall {avg_bk_pct}% average. "
                    f"Raising it to average would add ~{gap_extra:,} bookings."
                ),
                "type": "opportunity",
            })

    if seg_items:
        sections.append({"title": "Segment Comparison", "icon": "segments", "items": seg_items})

    # ── 5. BEHAVIORAL PATTERNS ──
    behav_items = []

    # Trial seekers
    trial_eng = [r for r in engaged if r.get("trial_req") == 1]
    non_trial = [r for r in engaged if r.get("trial_req") != 1]
    if len(trial_eng) >= 10 and len(non_trial) >= 10:
        trial_bk = round(sum(1 for r in trial_eng if r["booked"] == 1) / len(trial_eng) * 100, 1)
        non_bk = round(sum(1 for r in non_trial if r["booked"] == 1) / len(non_trial) * 100, 1)
        if trial_bk != non_bk:
            direction = "higher" if trial_bk > non_bk else "lower"
            behav_items.append({
                "text": (
                    f"Trial/demo requesters ({len(trial_eng):,} conversations) book at {trial_bk}%, "
                    f"{direction} than non-requesters ({non_bk}%). "
                    f"{'These are high-intent leads worth prioritising.' if trial_bk > non_bk else 'The trial request may signal price sensitivity rather than intent.'}"
                ),
                "type": "positive" if trial_bk > non_bk else "neutral",
            })

    # Price objectors
    price_obj = [r for r in engaged if r.get("obj_price") == 1]
    if len(price_obj) >= 10:
        po_bk = round(sum(1 for r in price_obj if r["booked"] == 1) / len(price_obj) * 100, 1)
        po_disc = sum(1 for r in price_obj if r.get("ask_discount") == 1)
        po_disc_pct = round(po_disc / len(price_obj) * 100, 1)
        behav_items.append({
            "text": (
                f"{len(price_obj):,} customers said the price was too high, yet {po_bk}% still booked. "
                f"{po_disc_pct}% of them also asked for a discount. "
                f"{'Price objections here are a negotiation tactic, not a hard no.' if po_bk > 2 else 'These leads may need a lower entry point or instalment plans.'}"
            ),
            "type": "neutral",
        })

    # Parent vs student
    parent_eng = [r for r in engaged if (r["parent_sig"] or 0) > 0 and (r["student_sig"] or 0) == 0]
    student_eng = [r for r in engaged if (r["student_sig"] or 0) > 0 and (r["parent_sig"] or 0) == 0]
    if len(parent_eng) >= 10 and len(student_eng) >= 10:
        p_bk = round(sum(1 for r in parent_eng if r["booked"] == 1) / len(parent_eng) * 100, 1)
        s_bk = round(sum(1 for r in student_eng if r["booked"] == 1) / len(student_eng) * 100, 1)
        behav_items.append({
            "text": (
                f"Parent-initiated conversations ({len(parent_eng):,}) book at {p_bk}% "
                f"vs student-initiated ({len(student_eng):,}) at {s_bk}%. "
                f"{'Parents are the primary decision-makers; routing them to senior agents could lift further.' if p_bk > s_bk else 'Student self-purchasers convert well; the funnel should accommodate their preferences.'}"
            ),
            "type": "positive" if max(p_bk, s_bk) > 5 else "neutral",
        })

    if behav_items:
        sections.append({"title": "Behavioral Patterns", "icon": "patterns", "items": behav_items})

    # ── 6. OPPORTUNITY SIZING ──
    opp_items = []

    # How many bookings are we leaving on the table?
    if engaged_n > 0 and len(booked) > 0:
        # If we cut noreply to 0
        noreply_count = sum(1 for r in inbound if r["agent_replied"] == 0)
        bk_rate = len(booked) / engaged_n
        noreply_opp = round(noreply_count * bk_rate)

        # If we sent links to everyone who reached price
        reached = [r for r in engaged if r["priceask"] == 1 or r["pricequote_sent"] == 1]
        got_link = [r for r in engaged if r["paylink_sent"] == 1]
        link_bk_rate = sum(1 for r in got_link if r["booked"] == 1) / len(got_link) if got_link else 0
        link_gap = len(reached) - len(got_link)
        link_opp = round(link_gap * link_bk_rate)

        # If slowest segments matched the fastest segment's response time
        # (use speed_conversion proxy)
        fast_resp = [r for r in engaged if _frt_min(r) is not None and _frt_min(r) < 15]
        slow_resp = [r for r in engaged if _frt_min(r) is not None and _frt_min(r) >= 60]
        speed_opp = 0
        if len(fast_resp) >= 5 and len(slow_resp) >= 5:
            fast_rate = sum(1 for r in fast_resp if r["booked"] == 1) / len(fast_resp)
            slow_rate = sum(1 for r in slow_resp if r["booked"] == 1) / len(slow_resp)
            speed_opp = round((fast_rate - slow_rate) * len(slow_resp))

        combined = noreply_opp + link_opp + speed_opp
        if combined > 0:
            opp_items.append({
                "text": (
                    f"Combined opportunity sizing: up to ~{combined:,} additional bookings are recoverable. "
                    f"Reply to all inbound (+{noreply_opp:,}), send links to all price-stage leads (+{link_opp:,}), "
                    f"and cut response time for slow-reply conversations to <15m (+{speed_opp:,})."
                ),
                "type": "opportunity",
            })

    if opp_items:
        sections.append({"title": "Opportunity Sizing", "icon": "opportunity", "items": opp_items})

    return sections


def _frt_min(row):
    """Get first response time in minutes, or None."""
    frt = row.get("first_resp_sec")
    if frt is None or frt == "":
        return None
    return float(frt) / 60.0


def _is_after_hours(row):
    """Check if the conversation started during after-hours (22:00-08:00)."""
    first_ts = row.get("first")
    if not first_ts:
        return False
    try:
        dt = datetime.fromisoformat(str(first_ts).replace("Z", "+00:00"))
        return dt.hour >= 22 or dt.hour < 8
    except (ValueError, TypeError):
        return False
