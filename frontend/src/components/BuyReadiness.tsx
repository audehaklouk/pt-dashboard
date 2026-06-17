import React from 'react';
import type { BuyReadinessData } from '../types';
import { SmallSampleBadge } from './SmallSampleBadge';

interface BuyReadinessProps {
  data: BuyReadinessData | null;
  engagedN: number | null;
}

export const BuyReadiness: React.FC<BuyReadinessProps> = ({ data, engagedN }) => {
  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-40 mb-4" />
        <div className="skeleton h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-[15px] font-semibold text-brand-text font-display">Buy Readiness</h3>
        {engagedN !== null && <SmallSampleBadge n={engagedN} />}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-brand-primary-100 rounded-btn p-4 text-center">
          <div className="text-2xl font-bold text-brand-text">{data.implicit_ready}</div>
          <div className="text-xs text-brand-text-secondary mt-1">Implicit Ready</div>
          <div className="text-xs text-brand-text-muted">{data.implicit_pct}% of engaged</div>
        </div>
        <div className="bg-brand-surface-2 rounded-btn p-4 text-center border border-brand-border">
          <div className="text-2xl font-bold text-brand-text">{data.explicit_ask}</div>
          <div className="text-xs text-brand-text-secondary mt-1">Explicit Ask (Paid)</div>
          <div className="text-xs text-brand-text-muted">{data.explicit_pct}% of engaged</div>
        </div>
      </div>

      {data.ready_no_link > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-btn p-3 flex items-start gap-2">
          <span className="text-amber-600 mt-0.5">&#9888;</span>
          <span className="text-sm text-amber-800">
            <strong>{data.ready_no_link.toLocaleString('en-US')}</strong> ready customers never got a payment link.
          </span>
        </div>
      )}

      <div className="text-xs text-brand-text-muted mt-3">
        Implicit = agreed after price (no price objection). Explicit = customer confirmed payment.
      </div>
    </div>
  );
};
