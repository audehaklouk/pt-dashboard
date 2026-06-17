# Data Dictionary — PT Conversation Dashboard

This package turns the Respond.io conversation analysis into a live, filterable dashboard.
Everything the dashboard shows is computed from **one row per conversation** in `seed/seed_threads.csv`.

---

## 1. The seed dataset — `seed/seed_threads.csv`

27,881 rows, one per conversation (a "thread" = one Respond.io Contact ID).
**No message text is stored** — only derived boolean flags, counts, and timestamps. Safe to share with stakeholders.

| Column | Type | Meaning |
|---|---|---|
| `workspace` | text | Source workspace, e.g. `National — KSA`, `Apex — Qatar`. Primary filter dimension. |
| `brand` | text | `National` or `Apex`. |
| `brand_label` | text | `National (Abwaab)` or `International (Apex)` — friendly label for the brand filter. |
| `country` | text | `KSA`, `Qatar`, `UAE`, `Bahrain`, `Jordan`. |
| `thread_date` | date (YYYY-MM-DD) | Date of the **first** message in the thread. Use for the date-range filter. |
| `first`, `last` | datetime ISO | First / last message timestamp in the thread. |
| `contact` | text | Respond.io Contact ID (internal id, not a phone/name). |
| `n_msg`, `n_in`, `n_out_human`, `n_out_auto` | int | Message counts: total, customer-in, human-agent-out, automated-out (bot+broadcast). |
| `has_inbound` | True/False | Customer sent ≥1 message. |
| `agent_replied` | True/False | A human agent sent ≥1 message. |
| `first_resp_sec` | float | Seconds from first customer message to first human reply (blank if never replied). |
| `last_role` | text | Who sent the last message: `out_human`, `in`, or `auto`. |
| `paylink_sent` | 0/1 | Agent sent a payment link or bank-transfer instructions (HyperPay / Abwaab Pay / Paymob / IBAN). |
| `paylink_dark` | 0/1/blank | 1 = customer never replied after the last payment link (blank if no link sent). |
| `pricequote_sent` | 0/1 | Agent quoted a price (currency + number). |
| `pricequote_dark` | 0/1/blank | 1 = customer went silent after the last price quote. |
| `priceask` | 0/1 | Customer asked about price. |
| `askparent` | 0/1 | Customer said they'll consult a parent/spouse. |
| `agentsched_sent` | 0/1 | Agent proposed a schedule/time. |
| `agentsched_dark` | 0/1/blank | 1 = customer went silent after the last schedule proposal. |
| `booked` | 0/1 | **Lower-bound proxy** — customer said they paid OR agent confirmed a completed booking in chat. NOT a true close rate. |
| `cust_paid`, `agent_confirm` | 0/1 | Components of `booked`. |
| `obj_price` | 0/1 | Customer said price is too high ("expensive"). |
| `ask_discount` | 0/1 | Customer asked for a discount/offer. |
| `obj_think` | 0/1 | Customer wants to think / will get back. |
| `obj_busy` | 0/1 | Customer too busy / no time. |
| `obj_online` | 0/1 | Online-vs-in-person / location question. |
| `trial_req` | 0/1 | Customer asked for a trial / free demo. |
| `tutor_qual` | 0/1 | Tutor quality / qualification concern. |
| `entry_tpl` | 0/1 | Inbound is the canned ad-entry line ("I want to book an online private lesson"). |
| `cap_resched` | 0/1 | Asked to reschedule / move a lesson. |
| `cap_avail` | 0/1 | Asked to see tutor availability/slots. |
| `cap_prog` | 0/1 | Asked for progress / report / feedback. |
| `cap_cancel` | 0/1 | Asked to cancel / refund. |
| `cap_rec` | 0/1 | Asked for a lesson recording. |
| `parent_sig`, `student_sig` | int | Count of messages signalling the writer is a parent / a student. |
| `n_broadcast`, `n_workflow` | int | Automated messages (mass-marketing / bot). |
| `reached_link` | 0/1 | Conversation reached the payment-link stage (= `paylink_sent`). "Converted" = 1, "leaked" = 0. |
| `t_trial_offer` | 0/1 | Topic: a trial/sample lesson was offered by the agent. |
| `t_trial_req` | 0/1 | Topic: customer asked for a trial / free demo. |
| `t_trial_done` | 0/1 | Topic: a trial was actually taken/completed. |
| `t_exam` | 0/1 | Topic: specific exam/curriculum content (subject, Qudrat/Tahsili/SAT, grade, syllabus). |
| `t_price` | 0/1 | Topic: customer asked a pricing/cost question. |
| `t_teacher` | 0/1 | Topic: teacher/instructor credentials discussed. |
| `t_competitor` | 0/1 | Topic: comparison to a competitor / other option (noisy, low volume — THIN). |
| `t_logistics` | 0/1 | Topic: logistics — schedule, platform, device, lesson link. |
| `t_social` | 0/1 | Topic: social proof — results, testimonials, friend referrals. |

> **Topic insight (converted vs leaked):** filter `reached_link=1` vs `=0` and compare topic prevalence. Converted and leaked discuss the **same** topics (exam content ~80–97% of both; price-objection identical) but converted reach **logistics** far more (≈83–93% vs 48%), carry more **trial + trust** signals (social proof, credentials), and resolve to a "yes." The divergence is resolution, not topic.

---

## 2. Metric definitions (compute these EXACTLY so the dashboard matches the report)

Let a filtered set of rows = `R`.

- **Threads** = `count(R)`
- **Inbound** = `count(has_inbound == True)`
- **Engaged / two-way** = `count(has_inbound == True AND agent_replied == True AND n_in >= 2)` — this is the denominator for objections/capabilities.
- **Reached price** = engaged AND (`priceask==1` OR `pricequote_sent==1`)
- **Payment link** = engaged AND `paylink_sent==1`
- **Booked (proxy)** = engaged AND `booked==1`
- **Funnel %**: inbound% = inbound/threads · two-way% = engaged/inbound · price% = reached/engaged · paylink% = paylink/engaged · booked% = booked/engaged
- **Payment continuation** (denominator = `paylink_sent==1`): dark% = mean(`paylink_dark==1`); continued% = 1 − dark%; booked-of-link% = mean(`booked==1`)
- **Drop after price** (denom `pricequote_sent==1`): mean(`pricequote_dark==1`)
- **Drop after schedule** (denom `agentsched_sent==1`): mean(`agentsched_dark==1`)
- **Objection rate** (denom = engaged): mean(`obj_* == 1`) — show as % of engaged
- **Capability requests** (denom = engaged): count(`cap_* == 1`)
- **First-response SLA**: median & p90 of `first_resp_sec` (convert to minutes); **No-reply %** = count(has_inbound==True AND agent_replied==False) / inbound
- **Parent vs student**: parent = `parent_sig>0 AND student_sig==0`; student = `student_sig>0 AND parent_sig==0`

> **Evidence caveat to surface in the UI:** when a filtered engaged-n < 30, mark the panel "small sample" (the original report tags these MODERATE/THIN). `booked` is a floor, not a close rate. The data only covers people who already messaged in — it says nothing about acquisition.

---

## 3. Raw import format — Respond.io export (for the Import button)

New uploads must be the **standard Respond.io CSV export** with these exact 11 columns (header row required):

```
"Date & Time","Sender ID","Sender Type","Contact ID","Message ID","Content Type","Message Type","Content","Channel ID","Type","Sub Type"
```

- `Sender Type`: `contact` = customer · `user`/`echo` = human agent · `workflow` = bot · `broadcast` = mass marketing.
- `Content`: JSON like `{"type":"text","text":"..."}` — the classifier extracts the text.
- One export file = one workspace. **The export does NOT contain country/brand**, so on import the user must tag: **Workspace name, Brand (National/International), Country.** Persist that tag with the rows.

`classifier.py` (in this package) is the single source of truth: it reconstructs threads by Contact ID, classifies every message with the audited Arabic+English rules, and emits exactly the `seed_threads.csv` schema above. The Import button must run this same file so old and new data stay identical in format.
