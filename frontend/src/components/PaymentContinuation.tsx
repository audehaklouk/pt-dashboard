import React, { useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import type { Payment } from '../types';
import { ExportButton } from './ExportButton';
import { SmallSampleBadge } from './SmallSampleBadge';

interface PaymentContinuationProps {
  data: Payment | null;
  engagedN: number | null;
}

const COLORS = {
  continued: '#22C55E',
  dark: '#EF4444',
};

export const PaymentContinuation: React.FC<PaymentContinuationProps> = ({ data, engagedN }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    return [
      'Metric,Value',
      `Payment Links Sent,${data.paylinks}`,
      `Continued,${data.continued}`,
      `Continued %,${data.cont_pct.toFixed(1)}%`,
      `Went Dark,${data.dark}`,
      `Dark %,${data.dark_pct.toFixed(1)}%`,
      `Booked (of link),${data.booked_of_link}`,
      `Booked (of link) %,${data.booked_of_link_pct.toFixed(1)}%`,
    ].join('\n');
  }, [data]);

  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-48 mb-4" />
        <div className="skeleton h-48 w-48 mx-auto rounded-full" />
      </div>
    );
  }

  const pieData = [
    { name: 'Continued', value: data.continued, color: COLORS.continued },
    { name: 'Went Dark', value: data.dark, color: COLORS.dark },
  ];

  const total = data.continued + data.dark;

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold text-brand-text font-display">Payment Continuation</h3>
          {engagedN !== null && <SmallSampleBadge n={engagedN} />}
        </div>
        <ExportButton csvData={csvData} csvFilename="payment.csv" pngTargetRef={chartRef} pngFilename="payment.png" />
      </div>

      <div className="flex flex-col items-center">
        <div className="relative">
          <ResponsiveContainer width={200} height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-brand-text">
              {data.booked_of_link_pct.toFixed(1)}%
            </span>
            <span className="text-xs text-brand-text-muted">booked</span>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.continued }} />
            <span className="text-sm text-brand-text-secondary">
              Continued {data.cont_pct.toFixed(1)}%
              <span className="text-brand-text-muted ml-1">({data.continued.toLocaleString('en-US')})</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.dark }} />
            <span className="text-sm text-brand-text-secondary">
              Went Dark {data.dark_pct.toFixed(1)}%
              <span className="text-brand-text-muted ml-1">({data.dark.toLocaleString('en-US')})</span>
            </span>
          </div>
        </div>

        <div className="text-xs text-brand-text-muted mt-3">
          {total.toLocaleString('en-US')} payment links sent &middot; In-app payment case
        </div>
      </div>
    </div>
  );
};
