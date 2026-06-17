import React, { useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList } from 'recharts';
import type { DropoffItem } from '../types';
import { ExportButton } from './ExportButton';
import { SmallSampleBadge } from './SmallSampleBadge';

interface DropoffMapProps {
  data: DropoffItem[] | null;
  engagedN: number | null;
}

function getColor(pct: number): string {
  if (pct >= 60) return '#EF4444';
  if (pct >= 40) return '#FFC629';
  return '#22C7B8';
}

export const DropoffMap: React.FC<DropoffMapProps> = ({ data, engagedN }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    const header = 'Event,N,Dark,Dark %';
    const rows = data.map(d => `${d.event},${d.n},${d.dark},${d.pct.toFixed(1)}%`);
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
        <h3 className="text-[15px] font-semibold text-brand-text font-display mb-4">Drop-off Map</h3>
        <div className="text-sm text-brand-text-muted text-center py-8">No drop-off data available</div>
      </div>
    );
  }

  const chartData = data.map(d => ({
    name: d.event,
    darkPct: d.pct,
    dark: d.dark,
    n: d.n,
    color: getColor(d.pct),
  }));

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold text-brand-text font-display">Drop-off Map</h3>
          {engagedN !== null && <SmallSampleBadge n={engagedN} />}
        </div>
        <ExportButton csvData={csvData} csvFilename="dropoff.csv" pngTargetRef={chartRef} pngFilename="dropoff.png" />
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 10, right: 60, left: 5, bottom: 5 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#5B6B8C', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#94A3B8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E6ECF5', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(16,24,40,.06)' }}
            labelStyle={{ color: '#0F1B3D' }}
            formatter={(value: number, name: string) => {
              if (name === 'darkPct') return [`${value.toFixed(1)}%`, 'Went Dark'];
              return [value, name];
            }}
          />
          <Bar dataKey="darkPct" radius={[8, 8, 0, 0]} barSize={48}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
            <LabelList
              dataKey="darkPct"
              position="top"
              formatter={(v: number) => `${v.toFixed(1)}%`}
              style={{ fill: '#0F1B3D', fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-4 mt-2 justify-center">
        {chartData.map((d, i) => (
          <div key={i} className="text-xs text-brand-text-muted">
            {d.name}: {d.dark.toLocaleString('en-US')} of {d.n.toLocaleString('en-US')}
          </div>
        ))}
      </div>
    </div>
  );
};
