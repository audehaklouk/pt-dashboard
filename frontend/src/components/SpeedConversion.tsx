import React, { useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList } from 'recharts';
import type { SpeedConversionItem } from '../types';
import { ExportButton } from './ExportButton';

interface SpeedConversionProps {
  data: SpeedConversionItem[] | null;
}

const GRADIENT = ['#22C55E', '#34D399', '#FFC629', '#FF7A8A', '#EF4444'];

export const SpeedConversion: React.FC<SpeedConversionProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    const header = 'Response Bucket,N,Booked,Booked %';
    const rows = data.map(d => `"${d.bucket}",${d.n},${d.booked},${d.booked_pct}%`);
    return [header, ...rows].join('\n');
  }, [data]);

  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-48 mb-4" />
        <div className="skeleton h-48 w-full" />
      </div>
    );
  }

  const chartData = data.map((d, i) => ({
    name: d.bucket,
    booked_pct: d.booked_pct,
    n: d.n,
    booked: d.booked,
    fill: GRADIENT[i] ?? '#64748B',
  }));

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-brand-text font-display">Speed &rarr; Conversion</h3>
        <ExportButton csvData={csvData} csvFilename="speed_conversion.csv" pngTargetRef={chartRef} pngFilename="speed_conversion.png" />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 10, right: 40, left: 5, bottom: 5 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#5B6B8C', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94A3B8', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E6ECF5', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(16,24,40,.06)' }}
            labelStyle={{ color: '#0F1B3D' }}
            formatter={(value: number, name: string) => {
              if (name === 'booked_pct') return [`${value.toFixed(1)}%`, 'Booking Rate'];
              return [value, name];
            }}
          />
          <Bar dataKey="booked_pct" radius={[8, 8, 0, 0]} barSize={40}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="booked_pct"
              position="top"
              formatter={(v: number) => `${v.toFixed(1)}%`}
              style={{ fill: '#0F1B3D', fontSize: 12, fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-3 mt-2 text-xs text-brand-text-muted justify-center">
        {chartData.map((d, i) => (
          <span key={i}>{d.name}: {d.n.toLocaleString('en-US')} conv, {d.booked} booked</span>
        ))}
      </div>
    </div>
  );
};
