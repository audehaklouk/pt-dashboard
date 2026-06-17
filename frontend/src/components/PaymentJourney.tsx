import React, { useRef, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer, LabelList } from 'recharts';
import type { PaymentJourneyData } from '../types';
import { ExportButton } from './ExportButton';
import { SmallSampleBadge } from './SmallSampleBadge';

interface PaymentJourneyProps {
  data: PaymentJourneyData | null;
  engagedN: number | null;
}

const COLORS = ['#2D5BFF', '#22C7B8', '#FFC629'];

export const PaymentJourney: React.FC<PaymentJourneyProps> = ({ data, engagedN }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    return [
      'Stage,Count',
      `Reached Price,${data.reached_price}`,
      `Got Payment Link,${data.got_link}`,
      `Booked,${data.booked}`,
    ].join('\n');
  }, [data]);

  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-40 mb-4" />
        <div className="skeleton h-48 w-full" />
      </div>
    );
  }

  const chartData = [
    { name: 'Reached Price', count: data.reached_price, fill: COLORS[0] },
    { name: 'Got Link', count: data.got_link, fill: COLORS[1] },
    { name: 'Booked', count: data.booked, fill: COLORS[2] },
  ];

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold text-brand-text font-display">Payment Journey</h3>
          {engagedN !== null && <SmallSampleBadge n={engagedN} />}
        </div>
        <ExportButton csvData={csvData} csvFilename="payment_journey.csv" pngTargetRef={chartRef} pngFilename="payment_journey.png" />
      </div>

      <ResponsiveContainer width="100%" height={180}>
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
            formatter={(value: number) => [value.toLocaleString('en-US'), 'Count']}
          />
          <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={28}>
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

      <div className="flex flex-wrap gap-4 mt-3 text-xs text-brand-text-secondary">
        <span>Price &rarr; Link: <strong className="text-brand-text">{data.price_to_link_pct}%</strong></span>
        <span>Link &rarr; Booked: <strong className="text-brand-text">{data.link_to_booked_pct}%</strong></span>
        <span>Price &rarr; Booked: <strong className="text-brand-text">{data.price_to_booked_pct}%</strong></span>
      </div>
    </div>
  );
};
