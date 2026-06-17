import React, { useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import type { ObjectionItem } from '../types';
import { ExportButton } from './ExportButton';
import { SmallSampleBadge } from './SmallSampleBadge';

interface ObjectionsChartProps {
  data: ObjectionItem[] | null;
  engagedN: number | null;
}

export const ObjectionsChart: React.FC<ObjectionsChartProps> = ({ data, engagedN }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    const header = 'Objection,Count,% of Engaged';
    const rows = data.map(d => `"${d.label}",${d.count},${d.pct.toFixed(1)}%`);
    return [header, ...rows].join('\n');
  }, [data]);

  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-40 mb-4" />
        <div className="skeleton h-48 w-full" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <h3 className="text-[15px] font-semibold text-brand-text font-display mb-4">Objections</h3>
        <div className="text-sm text-brand-text-muted text-center py-8">No objection data available</div>
      </div>
    );
  }

  const chartData = data
    .slice()
    .sort((a, b) => b.count - a.count)
    .map(d => ({
      name: d.label,
      count: d.count,
      pct: d.pct,
    }));

  const barHeight = Math.max(chartData.length * 36, 120);

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold text-brand-text font-display">Objections</h3>
          {engagedN !== null && <SmallSampleBadge n={engagedN} />}
        </div>
        <ExportButton csvData={csvData} csvFilename="objections.csv" pngTargetRef={chartRef} pngFilename="objections.png" />
      </div>
      <ResponsiveContainer width="100%" height={barHeight}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 80, left: 5, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fill: '#5B6B8C', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E6ECF5', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(16,24,40,.06)' }}
            labelStyle={{ color: '#0F1B3D' }}
            formatter={(value: number, name: string) => {
              if (name === 'count') return [value.toLocaleString('en-US'), 'Count'];
              return [value, name];
            }}
          />
          <Bar dataKey="count" fill="#FF7A8A" radius={[0, 8, 8, 0]} barSize={24}>
            <LabelList
              dataKey="count"
              position="right"
              formatter={(v: number) => `${v.toLocaleString('en-US')}`}
              style={{ fill: '#0F1B3D', fontSize: 12, fontWeight: 500 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-brand-text-muted">
        {chartData.map((d, i) => (
          <span key={i}>{d.name}: {d.pct.toFixed(1)}% of engaged</span>
        ))}
      </div>
    </div>
  );
};
