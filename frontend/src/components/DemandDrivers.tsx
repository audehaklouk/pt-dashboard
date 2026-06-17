import React from 'react';
import type { DemandDriversData } from '../types';
import { SmallSampleBadge } from './SmallSampleBadge';

interface DemandDriversProps {
  data: DemandDriversData | null;
  engagedN: number | null;
}

function liftBadge(lift: number): string {
  if (lift >= 1.5) return 'text-green-700 bg-green-50';
  if (lift >= 1.0) return 'text-brand-text bg-brand-surface-2';
  return 'text-red-700 bg-red-50';
}

export const DemandDrivers: React.FC<DemandDriversProps> = ({ data, engagedN }) => {
  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-40 mb-4" />
        <div className="skeleton h-32 w-full" />
      </div>
    );
  }

  const drivers = [
    {
      label: 'Exam-driven',
      share: data.exam_share,
      bk_pct: data.exam_bk_pct,
      n: data.exam_n,
      lift: data.exam_lift,
      color: 'border-t-chart-blue',
    },
    {
      label: 'Trial Requesters',
      share: data.trial_share,
      bk_pct: data.trial_bk_pct,
      n: data.trial_n,
      lift: data.trial_bk_pct && data.overall_bk_pct ? parseFloat((data.trial_bk_pct / data.overall_bk_pct).toFixed(1)) : 0,
      color: 'border-t-chart-teal',
    },
    {
      label: 'Parent-initiated',
      share: data.parent_share,
      bk_pct: data.parent_bk_pct,
      n: data.parent_n,
      lift: data.parent_bk_pct && data.overall_bk_pct ? parseFloat((data.parent_bk_pct / data.overall_bk_pct).toFixed(1)) : 0,
      color: 'border-t-chart-amber',
    },
  ];

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <h3 className="text-[15px] font-semibold text-brand-text font-display">Demand Drivers</h3>
        {engagedN !== null && <SmallSampleBadge n={engagedN} />}
      </div>

      <div className="text-xs text-brand-text-muted mb-4">
        Overall booking rate: <strong className="text-brand-text">{data.overall_bk_pct}%</strong>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {drivers.map((d, i) => (
          <div key={i} className={`border-t-2 ${d.color} bg-brand-surface rounded-btn shadow-card p-4`}>
            <div className="text-sm font-semibold text-brand-text mb-3">{d.label}</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-brand-text-muted">Share</span>
                <span className="text-brand-text font-medium">{d.share}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-brand-text-muted">Booking rate</span>
                <span className="text-brand-text font-medium">{d.bk_pct}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-brand-text-muted">Lift vs avg</span>
                <span className={`font-semibold px-1.5 py-0.5 rounded ${liftBadge(d.lift)}`}>
                  {d.lift}x
                </span>
              </div>
              <div className="text-xs text-brand-text-muted text-right">{d.n.toLocaleString('en-US')} conversations</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
