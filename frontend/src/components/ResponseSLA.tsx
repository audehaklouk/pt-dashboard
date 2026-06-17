import React, { useRef, useCallback } from 'react';
import type { ResponseSLAItem } from '../types';
import { ExportButton } from './ExportButton';
import { SmallSampleBadge } from './SmallSampleBadge';

interface ResponseSLAProps {
  data: ResponseSLAItem[] | null;
  engagedN: number | null;
}

function medianColor(min: number | null): string {
  if (min === null) return 'text-brand-text-muted';
  if (min < 15) return 'text-green-700';
  if (min < 60) return 'text-amber-700';
  return 'text-red-700';
}

function medianBg(min: number | null): string {
  if (min === null) return '';
  if (min < 15) return 'bg-green-50';
  if (min < 60) return 'bg-amber-50';
  return 'bg-red-50';
}

function fmtMin(v: number | null): string {
  if (v === null) return '--';
  return `${v.toFixed(0)}m`;
}

export const ResponseSLA: React.FC<ResponseSLAProps> = ({ data, engagedN }) => {
  const tableRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    const header = 'Workspace,Median (min),P90 (min),No-reply %,N (first replies)';
    const rows = data.map(d =>
      `"${d.workspace}",${d.median_min ?? ''},${d.p90_min ?? ''},${d.noreply_pct.toFixed(1)}%,${d.n_first}`
    );
    return [header, ...rows].join('\n');
  }, [data]);

  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-48 mb-4" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <h3 className="text-[15px] font-semibold text-brand-text font-display mb-4">Response SLA</h3>
        <div className="text-sm text-brand-text-muted text-center py-8">No SLA data available</div>
      </div>
    );
  }

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={tableRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold text-brand-text font-display">Response SLA</h3>
          {engagedN !== null && <SmallSampleBadge n={engagedN} />}
        </div>
        <ExportButton csvData={csvData} csvFilename="response_sla.csv" pngTargetRef={tableRef} pngFilename="response_sla.png" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">Workspace</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">Median</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">P90</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">No-reply %</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">N</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors duration-150">
                <td className="py-2.5 px-3 text-brand-text font-medium truncate max-w-[200px]">{row.workspace}</td>
                <td className={`py-2.5 px-3 text-right font-semibold rounded ${medianColor(row.median_min)} ${medianBg(row.median_min)}`}>
                  {fmtMin(row.median_min)}
                </td>
                <td className="py-2.5 px-3 text-right text-brand-text-secondary">
                  {fmtMin(row.p90_min)}
                </td>
                <td className="py-2.5 px-3 text-right text-brand-text-secondary">
                  {row.noreply_pct.toFixed(1)}%
                </td>
                <td className="py-2.5 px-3 text-right text-brand-text-muted">
                  {row.n_first.toLocaleString('en-US')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-brand-text-muted">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> &lt; 15m</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /> 15-60m</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> &gt; 60m</span>
      </div>
    </div>
  );
};
