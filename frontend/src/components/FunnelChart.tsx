import React, { useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList } from 'recharts';
import type { Funnel } from '../types';
import { ExportButton } from './ExportButton';
import { SmallSampleBadge } from './SmallSampleBadge';

interface FunnelChartProps {
  data: Funnel | null;
  engagedN: number | null;
}

const COLORS = ['#2D5BFF', '#22C7B8', '#FFC629', '#7C5CFC', '#FF7A8A', '#34D399'];

const STAGES: { key: keyof Funnel; label: string; pctKey: keyof Funnel | null }[] = [
  { key: 'threads', label: 'Threads', pctKey: null },
  { key: 'inbound', label: 'Inbound', pctKey: 'inb_pct' },
  { key: 'twoway', label: 'Two-way', pctKey: 'tw_pct_inb' },
  { key: 'reached_price', label: 'Reached Price', pctKey: 'price_pct_tw' },
  { key: 'paylink', label: 'Payment Link', pctKey: 'pl_pct_tw' },
  { key: 'booked', label: 'Booked', pctKey: 'bk_pct_tw' },
];

export const FunnelChart: React.FC<FunnelChartProps> = ({ data, engagedN }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    const header = 'Stage,Count,Stage-over-Stage %';
    const rows = STAGES.map(s => {
      const count = data[s.key] as number;
      const pct = s.pctKey ? (data[s.pctKey] as number).toFixed(1) : '100.0';
      return `${s.label},${count},${pct}%`;
    });
    return [header, ...rows].join('\n');
  }, [data]);

  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-40 mb-4" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  const chartData = STAGES.map((s, i) => ({
    name: s.label,
    count: data[s.key] as number,
    pct: s.pctKey ? (data[s.pctKey] as number) : 100,
    fill: COLORS[i],
  }));

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold text-brand-text font-display">Conversation Funnel</h3>
          {engagedN !== null && <SmallSampleBadge n={engagedN} />}
        </div>
        <ExportButton csvData={csvData} csvFilename="funnel.csv" pngTargetRef={chartRef} pngFilename="funnel.png" />
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 80, left: 5, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: '#5B6B8C', fontSize: 13 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E6ECF5', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(16,24,40,.06)' }}
            labelStyle={{ color: '#0F1B3D' }}
            itemStyle={{ color: '#5B6B8C' }}
            formatter={(value: number) => [value.toLocaleString('en-US'), 'Count']}
          />
          <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={32}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="count"
              position="right"
              formatter={(v: number) => v.toLocaleString('en-US')}
              style={{ fill: '#0F1B3D', fontSize: 13, fontWeight: 500 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-3 pl-[110px]">
        {chartData.slice(1).map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-brand-text-secondary">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
            {d.name}: {d.pct.toFixed(1)}% of prev
          </div>
        ))}
      </div>
    </div>
  );
};
