import React, { useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TopicInsightsData } from '../types';
import { ExportButton } from './ExportButton';
import { SmallSampleBadge } from './SmallSampleBadge';

interface TopicInsightsProps {
  data: TopicInsightsData | null;
  engagedN: number | null;
}

export const TopicInsights: React.FC<TopicInsightsProps> = ({ data, engagedN }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    const header = 'Topic,Converted %,Leaked %,Gap';
    const rows = data.topic_freq.map(d =>
      `"${d.label}",${d.converted_pct}%,${d.leaked_pct}%,${d.gap}`
    );
    return [header, ...rows].join('\n');
  }, [data]);

  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-48 mb-4" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  const chartData = data.topic_freq.map(d => ({
    name: d.label,
    Converted: d.converted_pct,
    Leaked: d.leaked_pct,
    gap: d.gap,
  }));

  const barHeight = Math.max(chartData.length * 44, 200);

  return (
    <div className="space-y-6">
      {/* Topic Frequency Chart */}
      <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-[15px] font-semibold text-brand-text font-display">Topic Frequency: Converted vs Leaked</h3>
            {engagedN !== null && <SmallSampleBadge n={engagedN} />}
          </div>
          <ExportButton csvData={csvData} csvFilename="topic_insights.csv" pngTargetRef={chartRef} pngFilename="topic_insights.png" />
        </div>

        <div className="flex items-center gap-4 mb-3 text-xs text-brand-text-muted">
          <span>Converted (reached link): <strong className="text-brand-text">{data.n_converted.toLocaleString('en-US')}</strong></span>
          <span>Leaked (no link): <strong className="text-brand-text">{data.n_leaked.toLocaleString('en-US')}</strong></span>
        </div>

        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 40, left: 5, bottom: 5 }}>
            <XAxis
              type="number"
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fill: '#5B6B8C', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E6ECF5', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(16,24,40,.06)' }}
              labelStyle={{ color: '#0F1B3D' }}
              formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#5B6B8C' }} />
            <Bar dataKey="Converted" fill="#2D5BFF" radius={[0, 6, 6, 0]} barSize={14} />
            <Bar dataKey="Leaked" fill="#FF7A8A" radius={[0, 6, 6, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Trial States + Converting Combos row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trial States */}
        <div className="bg-brand-surface rounded-card shadow-card p-6">
          <h3 className="text-[15px] font-semibold text-brand-text font-display mb-4">Trial States (among converted)</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-brand-primary-100 rounded-btn p-4 text-center">
              <div className="text-xl font-bold text-brand-text">{data.trial_states.offered}</div>
              <div className="text-xs text-brand-text-secondary mt-1">Offered</div>
              <div className="text-xs text-brand-text-muted">{data.trial_states.offered_pct}%</div>
            </div>
            <div className="bg-[#E8FFF5] rounded-btn p-4 text-center">
              <div className="text-xl font-bold text-brand-text">{data.trial_states.requested}</div>
              <div className="text-xs text-brand-text-secondary mt-1">Requested</div>
              <div className="text-xs text-brand-text-muted">{data.trial_states.requested_pct}%</div>
            </div>
            <div className="bg-[#FFF8E1] rounded-btn p-4 text-center">
              <div className="text-xl font-bold text-brand-text">{data.trial_states.completed}</div>
              <div className="text-xs text-brand-text-secondary mt-1">Completed</div>
              <div className="text-xs text-brand-text-muted">{data.trial_states.completed_pct}%</div>
            </div>
          </div>
        </div>

        {/* Converting Combinations */}
        <div className="bg-brand-surface rounded-card shadow-card p-6">
          <h3 className="text-[15px] font-semibold text-brand-text font-display mb-4">Converting Combinations</h3>
          {data.converting_combos.length === 0 ? (
            <div className="text-sm text-brand-text-muted text-center py-4">Not enough data for combo analysis</div>
          ) : (
            <>
              <div className="text-xs text-brand-text-muted mb-3">
                Base reach-link rate: <strong className="text-brand-text">{data.base_reach_rate}%</strong>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-border">
                      <th className="text-left py-2 px-2 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">Pair</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">N</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">Rate</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-brand-text-secondary uppercase tracking-wider bg-brand-surface-2">Lift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.converting_combos.map((combo, i) => (
                      <tr key={i} className="border-b border-brand-border/50 hover:bg-brand-surface-2 transition-colors duration-150">
                        <td className="py-2 px-2 text-brand-text text-xs">{combo.pair}</td>
                        <td className="py-2 px-2 text-right text-brand-text-muted">{combo.n}</td>
                        <td className="py-2 px-2 text-right font-semibold text-brand-text">{combo.reach_rate}%</td>
                        <td className={`py-2 px-2 text-right font-semibold ${combo.lift > 1 ? 'text-green-700' : 'text-brand-text-muted'}`}>
                          {combo.lift}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
