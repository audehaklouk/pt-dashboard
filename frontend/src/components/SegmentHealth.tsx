import React, { useRef, useCallback } from 'react';
import type { SegmentHealthItem } from '../types';
import { ExportButton } from './ExportButton';

interface SegmentHealthProps {
  data: SegmentHealthItem[] | null;
}

function cue(val: number, thresholds: [number, number]): string {
  if (val >= thresholds[1]) return 'text-green-700 bg-green-50';
  if (val >= thresholds[0]) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

function respCue(val: number | null): string {
  if (val === null) return 'text-brand-text-muted';
  if (val < 15) return 'text-green-700 bg-green-50';
  if (val < 60) return 'text-amber-700 bg-amber-50';
  return 'text-red-700 bg-red-50';
}

export const SegmentHealth: React.FC<SegmentHealthProps> = ({ data }) => {
  const tableRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    const header = 'Workspace,N,Two-way %,Payment Link Reach %,Booked %,Median Response (min)';
    const rows = data.map(d =>
      `"${d.workspace}",${d.n},${d.twoway_pct}%,${d.paylink_reach_pct}%,${d.booked_pct}%,${d.median_resp_min ?? ''}`
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
        <h3 className="text-[15px] font-semibold text-brand-text font-display mb-4">Segment Health Scorecard</h3>
        <div className="text-sm text-brand-text-muted text-center py-8">No segment data available</div>
      </div>
    );
  }

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={tableRef}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-brand-text font-display">Segment Health Scorecard</h3>
        <ExportButton csvData={csvData} csvFilename="segment_health.csv" pngTargetRef={tableRef} pngFilename="segment_health.png" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">Workspace</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">N</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">Two-way %</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">Link Reach %</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">Booked %</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">Median Resp</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors duration-150">
                <td className="py-2.5 px-3 text-brand-text font-medium truncate max-w-[200px]">{row.workspace}</td>
                <td className="py-2.5 px-3 text-right text-brand-text-muted">{row.n.toLocaleString('en-US')}</td>
                <td className={`py-2.5 px-3 text-right font-semibold rounded ${cue(row.twoway_pct, [30, 50])}`}>
                  {row.twoway_pct}%
                </td>
                <td className={`py-2.5 px-3 text-right font-semibold rounded ${cue(row.paylink_reach_pct, [10, 25])}`}>
                  {row.paylink_reach_pct}%
                </td>
                <td className={`py-2.5 px-3 text-right font-semibold rounded ${cue(row.booked_pct, [5, 15])}`}>
                  {row.booked_pct}%
                </td>
                <td className={`py-2.5 px-3 text-right font-semibold rounded ${respCue(row.median_resp_min)}`}>
                  {row.median_resp_min !== null ? `${row.median_resp_min.toFixed(0)}m` : '--'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
