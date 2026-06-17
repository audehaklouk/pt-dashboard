import React, { useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { ResponseByHourData } from '../types';
import { ExportButton } from './ExportButton';

interface ResponseByHourProps {
  data: ResponseByHourData | null;
}

export const ResponseByHour: React.FC<ResponseByHourProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    const header = 'Hour,Median (min),Count,After Hours';
    const rows = data.hours.map(h =>
      `${h.hour},${h.median_min ?? ''},${h.count},${h.is_after_hours}`
    );
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

  const chartData = data.hours.map(h => ({
    hour: `${h.hour}:00`,
    median: h.median_min ?? 0,
    count: h.count,
    isAfterHours: h.is_after_hours,
  }));

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-brand-text font-display">Response by Hour of Day</h3>
        <ExportButton csvData={csvData} csvFilename="response_by_hour.csv" pngTargetRef={chartRef} pngFilename="response_by_hour.png" />
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
          <XAxis
            dataKey="hour"
            tick={{ fill: '#5B6B8C', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v}m`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E6ECF5', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(16,24,40,.06)' }}
            labelStyle={{ color: '#0F1B3D' }}
            formatter={(value: number) => [`${value.toFixed(1)}m`, 'Median Response']}
          />
          <Bar dataKey="median" radius={[4, 4, 0, 0]} barSize={14}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.isAfterHours ? '#FF7A8A' : '#2D5BFF'}
                opacity={entry.isAfterHours ? 0.8 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5 text-brand-text-secondary">
          <div className="w-3 h-2 rounded-sm bg-chart-blue" />
          Business hours
        </div>
        <div className="flex items-center gap-1.5 text-brand-text-secondary">
          <div className="w-3 h-2 rounded-sm bg-chart-rose opacity-80" />
          After hours (22:00-08:00)
        </div>
        <span className="text-brand-text-muted">
          After-hours share: <strong className="text-brand-text">{data.after_hours_share}%</strong>
          {data.after_hours_median !== null && (
            <> &middot; Median: <strong className="text-brand-text">{data.after_hours_median}m</strong></>
          )}
        </span>
      </div>
    </div>
  );
};
