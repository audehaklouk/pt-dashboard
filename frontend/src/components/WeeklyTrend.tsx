import React, { useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { WeeklyTrendItem } from '../types';
import { ExportButton } from './ExportButton';

interface WeeklyTrendProps {
  data: WeeklyTrendItem[] | null;
}

export const WeeklyTrend: React.FC<WeeklyTrendProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    const header = 'Week,Inbound,Booked';
    const rows = data.map(d => `${d.week},${d.inbound},${d.booked}`);
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
        <h3 className="text-[15px] font-semibold text-brand-text font-display mb-4">Weekly Trend</h3>
        <div className="text-sm text-brand-text-muted text-center py-8">No trend data available</div>
      </div>
    );
  }

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-brand-text font-display">Weekly Trend</h3>
        <ExportButton csvData={csvData} csvFilename="weekly_trend.csv" pngTargetRef={chartRef} pngFilename="weekly_trend.png" />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
          <XAxis
            dataKey="week"
            tick={{ fill: '#5B6B8C', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.floor(data.length / 12))}
          />
          <YAxis
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E6ECF5', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(16,24,40,.06)' }}
            labelStyle={{ color: '#0F1B3D' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, color: '#5B6B8C' }}
          />
          <Bar dataKey="inbound" fill="#2D5BFF" radius={[4, 4, 0, 0]} barSize={12} name="Inbound" />
          <Bar dataKey="booked" fill="#FFC629" radius={[4, 4, 0, 0]} barSize={12} name="Booked" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
