import React from 'react';
import type { Headlines } from '../types';
import { SmallSampleBadge } from './SmallSampleBadge';

interface HeadlineTilesProps {
  data: Headlines | null;
  engagedN: number | null;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtMin(n: number | null): string {
  if (n === null) return '--';
  return `${n.toFixed(0)}m`;
}

const TILE_ACCENTS = [
  'border-t-2 border-t-chart-blue',
  'border-t-2 border-t-chart-teal',
  'border-t-2 border-t-chart-amber',
  'border-t-2 border-t-chart-green',
  'border-t-2 border-t-chart-violet',
];

interface TileProps {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}

const Tile: React.FC<TileProps> = ({ label, value, sub, accent }) => (
  <div className={`bg-brand-surface ${accent} rounded-card shadow-card p-5 flex flex-col items-center justify-center text-center transition-all duration-150 hover:shadow-card-hover`}>
    <div className="text-[28px] font-bold text-brand-text tracking-tight leading-none">{value}</div>
    <div className="text-xs font-medium text-brand-text-muted mt-2 uppercase tracking-wider">{label}</div>
    {sub && <div className="text-xs text-brand-text-muted mt-0.5">{sub}</div>}
  </div>
);

const SkeletonTile: React.FC = () => (
  <div className="bg-brand-surface rounded-card shadow-card p-5 flex flex-col items-center justify-center gap-2">
    <div className="skeleton h-8 w-24" />
    <div className="skeleton h-4 w-20" />
  </div>
);

export const HeadlineTiles: React.FC<HeadlineTilesProps> = ({ data, engagedN }) => {
  if (!data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => <SkeletonTile key={i} />)}
      </div>
    );
  }

  const tiles = [
    { label: 'Threads', value: fmt(data.threads) },
    { label: 'Two-way Rate', value: fmtPct(data.twoway_rate) },
    { label: 'Payment Link Reach', value: fmtPct(data.paylink_reach_pct) },
    { label: 'Booked', value: fmtPct(data.booked_pct) },
    { label: 'Median First Response', value: fmtMin(data.median_first_resp_min) },
  ];

  return (
    <div className="space-y-2">
      {engagedN !== null && <SmallSampleBadge n={engagedN} />}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {tiles.map((t, i) => (
          <Tile key={i} label={t.label} value={t.value} accent={TILE_ACCENTS[i]} />
        ))}
      </div>
    </div>
  );
};
