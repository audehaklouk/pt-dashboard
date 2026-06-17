import React from 'react';

interface SmallSampleBadgeProps {
  n: number;
}

export const SmallSampleBadge: React.FC<SmallSampleBadgeProps> = ({ n }) => {
  if (n >= 30) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
      <span aria-hidden="true">&#9888;</span> Small sample (n={n.toLocaleString('en-US')})
    </span>
  );
};
