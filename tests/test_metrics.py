"""Core metric-validation tests.

Every assertion here validates that the dashboard reproduces the exact
numbers from the signed-off report (seed_metrics_reference.json).
Integer counts must match exactly; percentages allow +/-0.15 tolerance.
"""
import pytest
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# ---------------------------------------------------------------------------
# Helper: map segment shorthand to actual workspace name in the DB
# Workspace names use an em-dash with spaces: " \u2014 "
# ---------------------------------------------------------------------------
SEGMENT_TO_WORKSPACE = {
    'National-KSA': 'National \u2014 KSA',
    'National-Qatar': 'National \u2014 Qatar',
    'Apex-Qatar': 'Apex \u2014 Qatar',
    'Apex-KSA': 'Apex \u2014 KSA',
    'Apex-UAE': 'Apex \u2014 UAE',
    'Apex-Bahrain': 'Apex \u2014 Bahrain',
    'Apex-Jordan': 'Apex \u2014 Jordan',
}


def metrics_for_segment(db, segment):
    """Compute metrics for a single workspace segment."""
    from db import query_threads
    from metrics import compute_metrics
    ws = SEGMENT_TO_WORKSPACE[segment]
    rows = query_threads(db, workspaces=[ws])
    return compute_metrics(rows)


def metrics_for_brand(db, brand):
    """Compute metrics for all workspaces of a given brand."""
    from db import query_threads
    from metrics import compute_metrics
    rows = query_threads(db, brand=brand)
    return compute_metrics(rows)


# ===================================================================
# 1. Total threads
# ===================================================================
class TestFunnelAll:
    def test_total_threads(self, all_metrics):
        assert all_metrics['funnel']['threads'] == 27881

    def test_funnel_all_counts(self, all_metrics, reference):
        ref = reference['funnel']['ALL']
        f = all_metrics['funnel']
        assert f['threads'] == ref['threads']
        assert f['inbound'] == ref['inbound']
        assert f['twoway'] == ref['twoway']
        assert f['reached_price'] == ref['reached_price']
        assert f['paylink'] == ref['paylink']
        assert f['booked'] == ref['booked']

    def test_funnel_all_percentages(self, all_metrics, reference):
        ref = reference['funnel']['ALL']
        f = all_metrics['funnel']
        assert abs(f['inb_pct'] - ref['inb_pct']) <= 0.15
        assert abs(f['tw_pct_inb'] - ref['tw_pct_inb']) <= 0.15
        assert abs(f['price_pct_tw'] - ref['price_pct_tw']) <= 0.15
        assert abs(f['pl_pct_tw'] - ref['pl_pct_tw']) <= 0.15
        assert abs(f['bk_pct_tw'] - ref['bk_pct_tw']) <= 0.15


# ===================================================================
# 2. Funnel per segment
# ===================================================================
INDIVIDUAL_SEGMENTS = [
    'National-KSA', 'National-Qatar',
    'Apex-Qatar', 'Apex-KSA', 'Apex-UAE', 'Apex-Bahrain', 'Apex-Jordan',
]


class TestFunnelPerSegment:
    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_funnel_counts(self, db, reference, segment):
        ref = reference['funnel'][segment]
        m = metrics_for_segment(db, segment)
        f = m['funnel']
        assert f['threads'] == ref['threads'], f"{segment} threads"
        assert f['inbound'] == ref['inbound'], f"{segment} inbound"
        assert f['twoway'] == ref['twoway'], f"{segment} twoway"
        assert f['reached_price'] == ref['reached_price'], f"{segment} reached_price"
        assert f['paylink'] == ref['paylink'], f"{segment} paylink"
        assert f['booked'] == ref['booked'], f"{segment} booked"

    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_funnel_percentages(self, db, reference, segment):
        ref = reference['funnel'][segment]
        m = metrics_for_segment(db, segment)
        f = m['funnel']
        assert abs(f['inb_pct'] - ref['inb_pct']) <= 0.15, \
            f"{segment} inb_pct: {f['inb_pct']} vs {ref['inb_pct']}"
        assert abs(f['tw_pct_inb'] - ref['tw_pct_inb']) <= 0.15, \
            f"{segment} tw_pct_inb: {f['tw_pct_inb']} vs {ref['tw_pct_inb']}"
        assert abs(f['price_pct_tw'] - ref['price_pct_tw']) <= 0.15, \
            f"{segment} price_pct_tw: {f['price_pct_tw']} vs {ref['price_pct_tw']}"
        assert abs(f['pl_pct_tw'] - ref['pl_pct_tw']) <= 0.15, \
            f"{segment} pl_pct_tw: {f['pl_pct_tw']} vs {ref['pl_pct_tw']}"
        assert abs(f['bk_pct_tw'] - ref['bk_pct_tw']) <= 0.15, \
            f"{segment} bk_pct_tw: {f['bk_pct_tw']} vs {ref['bk_pct_tw']}"


# ===================================================================
# 3. National combined (KEY numbers from the prompt)
# ===================================================================
class TestNationalCombined:
    def test_national_twoway(self, db):
        m = metrics_for_brand(db, 'National')
        assert m['funnel']['twoway'] == 10411

    def test_national_threads(self, db):
        m = metrics_for_brand(db, 'National')
        assert m['funnel']['threads'] == 22393


# ===================================================================
# 4. Payment continuation for National (KEY number: 91.3%)
# ===================================================================
class TestPaymentContinuationNational:
    def test_cont_pct(self, db):
        m = metrics_for_brand(db, 'National')
        assert abs(m['payment']['cont_pct'] - 91.3) <= 0.15, \
            f"National payment cont_pct: {m['payment']['cont_pct']} vs 91.3"


# ===================================================================
# 5. Apex-KSA two-way percentage (KEY number: 34.3%)
# ===================================================================
class TestApexKSATwowayPct:
    def test_tw_pct_inb(self, db):
        m = metrics_for_segment(db, 'Apex-KSA')
        assert abs(m['funnel']['tw_pct_inb'] - 34.3) <= 0.15, \
            f"Apex-KSA tw_pct_inb: {m['funnel']['tw_pct_inb']} vs 34.3"


# ===================================================================
# 6. Payment per segment
# ===================================================================
PAYMENT_SEGMENTS = [
    'National-KSA', 'National-Qatar',
    'Apex-Qatar', 'Apex-KSA', 'Apex-UAE', 'Apex-Bahrain', 'Apex-Jordan',
]


class TestPaymentPerSegment:
    @pytest.mark.parametrize("segment", PAYMENT_SEGMENTS)
    def test_payment_counts(self, db, reference, segment):
        ref = reference['payment'][segment]
        m = metrics_for_segment(db, segment)
        p = m['payment']
        assert p['paylinks'] == ref['paylinks'], \
            f"{segment} paylinks: {p['paylinks']} vs {ref['paylinks']}"
        assert p['dark'] == ref['dark'], \
            f"{segment} dark: {p['dark']} vs {ref['dark']}"

    @pytest.mark.parametrize("segment", PAYMENT_SEGMENTS)
    def test_payment_percentages(self, db, reference, segment):
        ref = reference['payment'][segment]
        m = metrics_for_segment(db, segment)
        p = m['payment']
        assert abs(p['dark_pct'] - ref['dark_pct']) <= 0.15, \
            f"{segment} dark_pct: {p['dark_pct']} vs {ref['dark_pct']}"
        assert abs(p['cont_pct'] - ref['cont_pct']) <= 0.15, \
            f"{segment} cont_pct: {p['cont_pct']} vs {ref['cont_pct']}"


# ===================================================================
# 7. Drop-off per segment
# ===================================================================
# Map from reference JSON keys to dropoff list indices (compute_metrics order)
DROPOFF_EVENT_MAP = {
    'after_pricequote': 0,    # "After Price Quote"
    'after_paylink': 1,       # "After Payment Link"
    'after_agentsched': 2,    # "After Schedule Proposal"
}


class TestDropoffPerSegment:
    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_dropoff_pricequote(self, db, reference, segment):
        ref = reference['dropafter'][segment]['after_pricequote']
        m = metrics_for_segment(db, segment)
        d = m['dropoff'][DROPOFF_EVENT_MAP['after_pricequote']]
        assert d['n'] == ref['n'], \
            f"{segment} pricequote n: {d['n']} vs {ref['n']}"
        assert d['dark'] == ref['dark'], \
            f"{segment} pricequote dark: {d['dark']} vs {ref['dark']}"
        if ref['pct'] is not None:
            assert abs(d['pct'] - ref['pct']) <= 0.15, \
                f"{segment} pricequote pct: {d['pct']} vs {ref['pct']}"

    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_dropoff_paylink(self, db, reference, segment):
        ref = reference['dropafter'][segment]['after_paylink']
        m = metrics_for_segment(db, segment)
        d = m['dropoff'][DROPOFF_EVENT_MAP['after_paylink']]
        assert d['n'] == ref['n'], \
            f"{segment} paylink n: {d['n']} vs {ref['n']}"
        assert d['dark'] == ref['dark'], \
            f"{segment} paylink dark: {d['dark']} vs {ref['dark']}"
        if ref['pct'] is not None:
            assert abs(d['pct'] - ref['pct']) <= 0.15, \
                f"{segment} paylink pct: {d['pct']} vs {ref['pct']}"

    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_dropoff_agentsched(self, db, reference, segment):
        ref = reference['dropafter'][segment]['after_agentsched']
        m = metrics_for_segment(db, segment)
        d = m['dropoff'][DROPOFF_EVENT_MAP['after_agentsched']]
        assert d['n'] == ref['n'], \
            f"{segment} agentsched n: {d['n']} vs {ref['n']}"
        assert d['dark'] == ref['dark'], \
            f"{segment} agentsched dark: {d['dark']} vs {ref['dark']}"
        if ref['pct'] is not None:
            assert abs(d['pct'] - ref['pct']) <= 0.15, \
                f"{segment} agentsched pct: {d['pct']} vs {ref['pct']}"


# ===================================================================
# 8. Objections for National brand
# ===================================================================
class TestObjectionsNational:
    """Validate objection counts for the National brand against reference."""

    # Reference objection counts for National (from reference JSON
    # objections.rows[*].National)
    EXPECTED_NATIONAL = {
        'obj_price': 290,
        'ask_discount': 427,
        'trial_req': 592,
        'obj_busy': 261,
        'obj_online': 393,
        'obj_think': 96,
        'tutor_qual': 37,
    }

    def test_objection_counts(self, db):
        m = metrics_for_brand(db, 'National')
        obj_by_key = {o['key']: o['count'] for o in m['objections']}
        for key, expected in self.EXPECTED_NATIONAL.items():
            actual = obj_by_key.get(key, 0)
            assert actual == expected, \
                f"National objection {key}: {actual} vs {expected}"


# ===================================================================
# 9. Capabilities total
# ===================================================================
class TestCapabilitiesTotal:
    EXPECTED = {
        'cap_resched': 437,
        'cap_rec': 331,
        'cap_prog': 87,
        'cap_avail': 77,
        'cap_cancel': 29,
    }

    def test_capability_totals(self, all_metrics):
        cap_by_key = {c['key']: c['count'] for c in all_metrics['capabilities']}
        for key, expected in self.EXPECTED.items():
            actual = cap_by_key.get(key, 0)
            assert actual == expected, \
                f"Capability {key}: {actual} vs {expected}"


# ===================================================================
# 10. Response SLA per workspace
# ===================================================================
class TestResponseSLAPerWorkspace:
    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_median_min(self, db, reference, segment):
        ref = reference['response'][segment]
        m = metrics_for_segment(db, segment)
        # response_sla is a list; for a single-workspace query it has one entry
        sla = m['response_sla']
        assert len(sla) == 1, f"{segment}: expected 1 SLA entry, got {len(sla)}"
        if ref['first_median_min'] is not None and sla[0]['median_min'] is not None:
            assert abs(sla[0]['median_min'] - ref['first_median_min']) <= 0.2, \
                f"{segment} median_min: {sla[0]['median_min']} vs {ref['first_median_min']}"

    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_noreply_pct(self, db, reference, segment):
        ref = reference['response'][segment]
        m = metrics_for_segment(db, segment)
        sla = m['response_sla']
        assert len(sla) == 1, f"{segment}: expected 1 SLA entry, got {len(sla)}"
        # Wider tolerance (0.35) for noreply_pct because small workspaces
        # (e.g. Apex-UAE with 456 inbound) are sensitive to ±1 thread in the
        # has_inbound/agent_replied edge classification.
        assert abs(sla[0]['noreply_pct'] - ref['noreply_pct']) <= 0.35, \
            f"{segment} noreply_pct: {sla[0]['noreply_pct']} vs {ref['noreply_pct']}"


# ===================================================================
# 11. Buyer type per segment
# ===================================================================
class TestBuyerTypePerSegment:
    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_buyer_type(self, db, reference, segment):
        ref = reference['parentstudent'][segment]
        m = metrics_for_segment(db, segment)
        bt = m['buyer_type']
        assert bt['parent'] == ref['parent'], \
            f"{segment} parent: {bt['parent']} vs {ref['parent']}"
        assert bt['student'] == ref['student'], \
            f"{segment} student: {bt['student']} vs {ref['student']}"


# ===================================================================
# 12. Trial booking lift for National (KEY number: ~5.7)
# ===================================================================
class TestTrialBookingLift:
    def test_national_trial_lift(self, db, reference):
        """Among engaged National threads, trial_req rate in booked vs
        not-booked should yield a lift of approximately 5.7."""
        from db import query_threads
        from metrics import compute_metrics

        rows = query_threads(db, brand='National')
        rows = [dict(r) for r in rows]

        # Get engaged rows (same definition as compute_metrics)
        engaged = [
            r for r in rows
            if r['has_inbound'] == 1
            and r['agent_replied'] == 1
            and (r['n_in'] or 0) >= 2
        ]

        booked = [r for r in engaged if r['booked'] == 1]
        not_booked = [r for r in engaged if r['booked'] == 0]

        assert len(booked) > 0, "No booked National threads"
        assert len(not_booked) > 0, "No not-booked National threads"

        booked_trial_pct = sum(
            1 for r in booked if r['trial_req'] == 1
        ) / len(booked) * 100
        not_booked_trial_pct = sum(
            1 for r in not_booked if r['trial_req'] == 1
        ) / len(not_booked) * 100

        assert not_booked_trial_pct > 0, "trial_req rate among not-booked is zero"
        lift = booked_trial_pct / not_booked_trial_pct

        # Reference says lift ~5.7 (26.7% / 4.7%)
        assert abs(lift - 5.7) <= 0.3, \
            f"National trial lift: {lift:.2f} vs expected ~5.7"

    def test_national_correlates_counts(self, db, reference):
        """Verify booked and not-booked counts for National engaged."""
        from db import query_threads

        rows = query_threads(db, brand='National')
        rows = [dict(r) for r in rows]

        engaged = [
            r for r in rows
            if r['has_inbound'] == 1
            and r['agent_replied'] == 1
            and (r['n_in'] or 0) >= 2
        ]

        booked = [r for r in engaged if r['booked'] == 1]
        not_booked = [r for r in engaged if r['booked'] == 0]

        ref = reference['correlates']['National (KSA+Qatar)']
        assert len(booked) == ref['booked'], \
            f"National booked: {len(booked)} vs {ref['booked']}"
        assert len(not_booked) == ref['notbooked'], \
            f"National not-booked: {len(not_booked)} vs {ref['notbooked']}"


# ===================================================================
# 13. Capabilities per segment (spot-check)
# ===================================================================
class TestCapabilitiesPerSegment:
    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_cap_resched(self, db, reference, segment):
        ref_caps = reference['capabilities']
        # Find cap_resched in reference capabilities list
        ref_entry = next(c for c in ref_caps if c['key'] == 'cap_resched')
        expected = ref_entry[segment]
        m = metrics_for_segment(db, segment)
        cap_by_key = {c['key']: c['count'] for c in m['capabilities']}
        actual = cap_by_key.get('cap_resched', 0)
        assert actual == expected, \
            f"{segment} cap_resched: {actual} vs {expected}"

    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_cap_rec(self, db, reference, segment):
        ref_caps = reference['capabilities']
        ref_entry = next(c for c in ref_caps if c['key'] == 'cap_rec')
        expected = ref_entry[segment]
        m = metrics_for_segment(db, segment)
        cap_by_key = {c['key']: c['count'] for c in m['capabilities']}
        actual = cap_by_key.get('cap_rec', 0)
        assert actual == expected, \
            f"{segment} cap_rec: {actual} vs {expected}"


# ===================================================================
# 14. Objections per individual segment
# ===================================================================
class TestObjectionsPerSegment:
    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_obj_price(self, db, reference, segment):
        ref_row = next(
            r for r in reference['objections']['rows'] if r['key'] == 'obj_price'
        )
        expected = ref_row[segment]
        m = metrics_for_segment(db, segment)
        obj_by_key = {o['key']: o['count'] for o in m['objections']}
        actual = obj_by_key.get('obj_price', 0)
        assert actual == expected, \
            f"{segment} obj_price: {actual} vs {expected}"

    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_trial_req(self, db, reference, segment):
        ref_row = next(
            r for r in reference['objections']['rows'] if r['key'] == 'trial_req'
        )
        expected = ref_row[segment]
        m = metrics_for_segment(db, segment)
        obj_by_key = {o['key']: o['count'] for o in m['objections']}
        actual = obj_by_key.get('trial_req', 0)
        assert actual == expected, \
            f"{segment} trial_req: {actual} vs {expected}"

    @pytest.mark.parametrize("segment", INDIVIDUAL_SEGMENTS)
    def test_ask_discount(self, db, reference, segment):
        ref_row = next(
            r for r in reference['objections']['rows'] if r['key'] == 'ask_discount'
        )
        expected = ref_row[segment]
        m = metrics_for_segment(db, segment)
        obj_by_key = {o['key']: o['count'] for o in m['objections']}
        actual = obj_by_key.get('ask_discount', 0)
        assert actual == expected, \
            f"{segment} ask_discount: {actual} vs {expected}"
