import React, { useRef, useCallback } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { BuyerType as BuyerTypeData } from '../types';
import { ExportButton } from './ExportButton';
import { SmallSampleBadge } from './SmallSampleBadge';

interface BuyerTypeProps {
  data: BuyerTypeData | null;
  engagedN: number | null;
}

const COLORS = {
  parent: '#2D5BFF',
  student: '#FFC629',
  unknown: '#7C5CFC',
};

export const BuyerType: React.FC<BuyerTypeProps> = ({ data, engagedN }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    return [
      'Buyer Type,Count,Percentage',
      `Parent,${data.parent},${data.parent_pct.toFixed(1)}%`,
      `Student,${data.student},${data.student_pct.toFixed(1)}%`,
      `Unknown,${data.unknown},${data.unknown_pct.toFixed(1)}%`,
    ].join('\n');
  }, [data]);

  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-40 mb-4" />
        <div className="skeleton h-48 w-48 mx-auto rounded-full" />
      </div>
    );
  }

  const total = data.parent + data.student + data.unknown;
  if (total === 0) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <h3 className="text-[15px] font-semibold text-brand-text font-display mb-4">Buyer Type</h3>
        <div className="text-sm text-brand-text-muted text-center py-8">No buyer type data available</div>
      </div>
    );
  }

  const pieData = [
    { name: 'Parent', value: data.parent, pct: data.parent_pct, color: COLORS.parent },
    { name: 'Student', value: data.student, pct: data.student_pct, color: COLORS.student },
    { name: 'Unknown', value: data.unknown, pct: data.unknown_pct, color: COLORS.unknown },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-[15px] font-semibold text-brand-text font-display">Buyer Type</h3>
          {engagedN !== null && <SmallSampleBadge n={engagedN} />}
        </div>
        <ExportButton csvData={csvData} csvFilename="buyer_type.csv" pngTargetRef={chartRef} pngFilename="buyer_type.png" />
      </div>

      <div className="flex flex-col items-center">
        <ResponsiveContainer width={220} height={220}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E6ECF5', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(16,24,40,.06)' }}
              formatter={(value: number, name: string) => [`${value.toLocaleString('en-US')}`, name]}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="flex items-center gap-5 mt-2">
          {pieData.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-sm text-brand-text-secondary">
                {d.name} {d.pct.toFixed(1)}%
                <span className="text-brand-text-muted ml-1">({d.value.toLocaleString('en-US')})</span>
              </span>
            </div>
          ))}
        </div>

        <div className="text-xs text-brand-text-muted mt-2">
          {total.toLocaleString('en-US')} total conversations
        </div>
      </div>
    </div>
  );
};
