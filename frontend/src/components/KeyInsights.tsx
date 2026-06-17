import React, { useState } from 'react';

type Evidence = 'STRONG' | 'MODERATE' | 'THIN';

interface Insight {
  headline: string;
  body: string;
  evidence: Evidence;
  source: React.ReactNode;
}

const BADGE: Record<Evidence, { bg: string; text: string }> = {
  STRONG:   { bg: 'bg-green-50 border-green-200', text: 'text-green-700' },
  MODERATE: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  THIN:     { bg: 'bg-gray-100 border-gray-200', text: 'text-gray-500' },
};

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        const el = document.querySelector(href);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }}
      className="text-brand-primary hover:underline"
    >
      {children}
    </a>
  );
}

const INSIGHTS: Insight[] = [
  {
    headline: 'The funnel leaks upstream, not at payment.',
    body: 'Only ~12% of engaged National chats ever reach a payment link; 91% of those who do keep going and <1% report a failure.',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-funnel">Funnel</A> + <A href="#panel-payment">payment continuation</A> — 10,411 engaged / 1,221 link threads (National).</>,
  },
  {
    headline: 'Converted and leaked chats discuss the same things — they diverge in resolution.',
    body: 'Same exam/price topics; identical price-too-high rate (6.7% vs 6.3%). The gap is the ending — 81% of converters agree after the price vs 22% of leakers — and reaching logistics (83% vs 48%).',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-topic-insights">Topic analysis</A> — reached_link cohorts, 1,221 converted vs 9,190 leaked.</>,
  },
  {
    headline: 'Buy-readiness is implicit, not an explicit ask.',
    body: '~1% ask "how do I pay"; ~11% say "ok / let\'s go" after a price (10\u00d7 more) and book 9.4\u00d7 more. 44% of ready customers never get a link.',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-buy-readiness">Payment-readiness analysis</A> — National engaged (10,411).</>,
  },
  {
    headline: 'A trial + a trust signal is the converting signature.',
    body: 'Trial + social proof reaches payment 85% of the time (7.2\u00d7); trial + teacher credentials 75% (6.4\u00d7). Trials are a hook — completed before paying in only 1.2%.',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-topic-insights">Topic-combination analysis</A> — National engaged.</>,
  },
  {
    headline: 'Offering a trial early is the strongest single conversion lever.',
    body: 'Trial-askers book 26.7% vs 4.7% (5.7\u00d7) in National; 29% vs 4.3% in Apex.',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-demand-drivers">Booking-correlates analysis</A>.</>,
  },
  {
    headline: 'Pricing is scattered — make fixed bundles.',
    body: '59 different per-session prices quoted (20\u2013300 \uFDFC), ~22% ad-hoc \u201cwas X now Y\u201d discounts, 8.2% of chats re-ask the price.',
    evidence: 'STRONG',
    source: <>Source: Pricing-clarity scan — National engaged.</>,
  },
  {
    headline: 'In-app payment is an efficiency + visibility play, not a growth lever.',
    body: 'Links aren\u2019t abandoned. The wins: remove ~1,225 hand-sent links + ~43% bank-transfer reconciliation, capture the ready-but-stranded, and get automatic payment status.',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-payment">Payment deep-dive</A> — 1,225 National link threads.</>,
  },
  {
    headline: 'Median response is fine; the tail and after-hours kill momentum.',
    body: '28.5% of inbound arrives 10pm\u20138am and waits ~2.7h (vs 4 min daytime); 7% never get answered; <5-min replies book 6.3% vs 1.8% after 4h. ~65% of openers are AI-answerable.',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-response-by-hour">Response-time deep-dive</A> — 21,013 inbound threads.</>,
  },
  {
    headline: 'Exam urgency is the demand engine.',
    body: '38% of engaged National chats are exam-driven and book 2.8\u00d7 more (10.9% vs 3.9%); peaks late-Jan/early-Feb and late-May.',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-demand-drivers">Demand discovery</A> — National engaged.</>,
  },
  {
    headline: 'A female-tutor request is the highest-converting signal in the data.',
    body: '10.9% ask for a female tutor; they book 6.8\u00d7 more (27.2% vs 4.0%). Supply-constrained — unmet requests are lost high-intent buyers.',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-demand-drivers">Demand discovery</A> — National engaged (tutor supply not visible in chat).</>,
  },
  {
    headline: 'Demand \u2260 conversion — volume traps vs gems.',
    body: 'Qudrat (16%) / Tahsili (13%) drive volume but convert ~6%; sciences (Physics/Chem/Bio) convert 21\u201324%.',
    evidence: 'STRONG',
    source: <>Source: Subject demand \u00d7 conversion — National engaged.</>,
  },
  {
    headline: 'Reschedule and recordings are the top self-serve gaps.',
    body: 'Reschedule is the #1 capability request (437 threads), recording #2 (331) — both handled by hand today.',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-capabilities">Capability-request analysis</A>.</>,
  },
  {
    headline: 'Apex-KSA\u2019s ad funnel is broken; Apex-Qatar is healthy.',
    body: '66% of Apex-KSA inbound is one canned ad line, 34% become two-way, ~0% book in chat — vs Apex-Qatar 10% canned, 52% two-way, 3.5% booked.',
    evidence: 'STRONG',
    source: <>Source: <A href="#panel-segment-health">Funnel by segment</A> (after correcting the mislabeled Qatar export).</>,
  },
];

export const KeyInsights: React.FC = () => {
  const [open, setOpen] = useState(false);

  return (
    <div id="panel-key-insights" className="bg-brand-surface rounded-card shadow-card overflow-hidden">
      {/* Clickable header — always visible */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-brand-surface-2/50 transition-colors duration-150"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-primary-100">
            <svg className="w-4 h-4 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-brand-text font-display">Key Insights</h2>
            <p className="text-xs text-brand-text-muted">13 curated findings from 27,881 conversations &middot; click to {open ? 'collapse' : 'expand'}</p>
          </div>
        </div>
        <svg className={`w-5 h-5 text-brand-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      {open && (
        <>
          {/* Data lineage */}
          <div className="px-6 pb-4 border-b border-brand-border">
            <p className="text-xs text-brand-text-muted leading-relaxed">
              Derived from 27,881 Respond conversations (585,691 messages), Jan 1 – Jun 15 2026,
              National (Abwaab: KSA, Qatar) + Apex (Qatar, KSA, UAE, Bahrain, Jordan).
              Engaged = customer sent &ge;2 messages and an agent replied (12,469).
              Tagged by Arabic+English keyword detectors (~85–95% precision).
              &ldquo;Booked&rdquo; is a lower-bound chat proxy.
              Conversion &amp; product signal only — not acquisition.
            </p>
            <p className="text-xs text-brand-primary font-medium mt-2">
              Figures reflect the full Jan–Jun corpus; use the filters above to explore live cuts.
            </p>
          </div>

          {/* Insight rows */}
          <div className="divide-y divide-brand-border/60">
        {INSIGHTS.map((item, i) => {
          const badge = BADGE[item.evidence];
          return (
            <div key={i} className="px-6 py-4 hover:bg-brand-surface-2/50 transition-colors duration-150">
              <div className="flex items-start gap-3">
                {/* Number */}
                <span className="text-xs font-bold text-brand-text-muted mt-0.5 w-5 shrink-0 text-right">
                  {i + 1}.
                </span>

                <div className="flex-1 min-w-0">
                  {/* Headline + badge */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-brand-text leading-snug">
                      {item.headline}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badge.bg} ${badge.text}`}>
                      {item.evidence}
                    </span>
                  </div>

                  {/* Body */}
                  <p className="text-sm text-brand-text-secondary leading-relaxed mb-1.5">
                    {item.body}
                  </p>

                  {/* Source */}
                  <p className="text-xs text-brand-text-muted italic leading-relaxed">
                    {item.source}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

          {/* Limits footer */}
          <div className="px-6 py-4 bg-brand-surface-2 border-t border-brand-border">
            <p className="text-xs text-brand-text-muted leading-relaxed">
              <strong className="text-brand-text-secondary">Limits:</strong>{' '}
              survivorship — only people who messaged in; &ldquo;booked/agreed&rdquo; are proxies, not billing;
              detection ~85–95% (treat the &ldquo;competitor&rdquo; tag and small samples as low-confidence);
              converting patterns are correlational.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
