import React from 'react';
import type { InsightSection, InsightItem } from '../types';

interface AutoInsightsProps {
  data: InsightSection[] | null;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  summary: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  bottleneck: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  ),
  speed: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  segments: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  patterns: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  opportunity: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
};

const TYPE_STYLES: Record<InsightItem['type'], { dot: string; bg: string }> = {
  positive: { dot: 'bg-green-500', bg: '' },
  negative: { dot: 'bg-red-400', bg: '' },
  neutral: { dot: 'bg-brand-primary', bg: '' },
  opportunity: { dot: 'bg-amber-400', bg: 'bg-amber-50/50' },
};

export const AutoInsights: React.FC<AutoInsightsProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-40 mb-4" />
        <div className="skeleton h-32 w-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <h3 className="text-[15px] font-semibold text-brand-text font-display mb-4">Narrative Insights</h3>
        <div className="text-sm text-brand-text-muted text-center py-4">Not enough data for insights</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((section, si) => (
        <div key={si} className="bg-brand-surface rounded-card shadow-card overflow-hidden">
          {/* Section header */}
          <div className="flex items-center gap-2.5 px-6 pt-5 pb-3">
            <div className="text-brand-primary">
              {ICON_MAP[section.icon] ?? ICON_MAP.summary}
            </div>
            <h3 className="text-[15px] font-semibold text-brand-text font-display">
              {section.title}
            </h3>
          </div>

          {/* Items */}
          <div className="px-6 pb-5 space-y-3">
            {section.items.map((item, ii) => {
              const style = TYPE_STYLES[item.type];
              return (
                <div
                  key={ii}
                  className={`flex items-start gap-3 text-sm text-brand-text-secondary leading-relaxed rounded-btn p-3 -mx-1 ${style.bg}`}
                >
                  <span className={`w-2 h-2 rounded-full ${style.dot} mt-1.5 shrink-0`} />
                  <span>{item.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
