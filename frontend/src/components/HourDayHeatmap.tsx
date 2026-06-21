import React, { useRef, useCallback, useState } from 'react';
import type { HourDayHeatmapData, HeatmapCell } from '../types';
import { ExportButton } from './ExportButton';

interface HourDayHeatmapProps {
  data: HourDayHeatmapData | null;
  engagedN: number | null;
}

type MetricMode = 'volume' | 'booked_pct' | 'median_resp';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getColor(value: number, max: number, mode: MetricMode): string {
  if (max === 0 || value === 0) return '#F8FAFF';
  const ratio = Math.min(value / max, 1);

  if (mode === 'volume') {
    // Blue scale
    const r = Math.round(232 - ratio * (232 - 45));
    const g = Math.round(238 - ratio * (238 - 91));
    const b = Math.round(255 - ratio * (255 - 255));
    return `rgb(${r}, ${g}, ${b})`;
  }
  if (mode === 'booked_pct') {
    // Green scale
    const r = Math.round(240 - ratio * (240 - 34));
    const g = Math.round(253 - ratio * (253 - 197));
    const b = Math.round(244 - ratio * (244 - 94));
    return `rgb(${r}, ${g}, ${b})`;
  }
  // median_resp — Red scale (higher = worse)
  const r = Math.round(254 - ratio * (254 - 239));
  const g = Math.round(242 - ratio * (242 - 68));
  const b = Math.round(242 - ratio * (242 - 68));
  return `rgb(${r}, ${g}, ${b})`;
}

function formatHour(h: number): string {
  if (h === 0) return '12a';
  if (h < 12) return `${h}a`;
  if (h === 12) return '12p';
  return `${h - 12}p`;
}

export const HourDayHeatmap: React.FC<HourDayHeatmapProps> = ({ data, engagedN }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<MetricMode>('volume');
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const csvData = useCallback((): string => {
    if (!data) return '';
    const header = 'Day,Hour,Volume,Engaged,Booked,Booked%,MedianResp(min),AfterHours';
    const rows = data.cells.map(c =>
      `${c.day_name},${c.hour},${c.volume},${c.engaged},${c.booked},${c.booked_pct},${c.median_resp_min ?? ''},${c.is_after_hours}`
    );
    return [header, ...rows].join('\n');
  }, [data]);

  if (!data) {
    return (
      <div className="bg-brand-surface rounded-card shadow-card p-6">
        <div className="skeleton h-5 w-56 mb-4" />
        <div className="skeleton h-[220px] w-full" />
      </div>
    );
  }

  // Build lookup grid
  const grid: Record<string, HeatmapCell> = {};
  for (const cell of data.cells) {
    grid[`${cell.day}-${cell.hour}`] = cell;
  }

  // Compute max for current mode
  let maxVal = 0;
  for (const cell of data.cells) {
    let val = 0;
    if (mode === 'volume') val = cell.volume;
    else if (mode === 'booked_pct') val = cell.booked_pct;
    else if (mode === 'median_resp') val = cell.median_resp_min ?? 0;
    if (val > maxVal) maxVal = val;
  }

  const modeLabels: Record<MetricMode, string> = {
    volume: 'Conversation Volume',
    booked_pct: 'Booking Rate (%)',
    median_resp: 'Median Response (min)',
  };

  return (
    <div className="bg-brand-surface rounded-card shadow-card p-6" ref={chartRef}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-[15px] font-semibold text-brand-text font-display">
          Hour &times; Day Heatmap
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-btn overflow-hidden border border-brand-border text-xs">
            {(['volume', 'booked_pct', 'median_resp'] as MetricMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 transition-colors ${
                  mode === m
                    ? 'bg-brand-primary text-white'
                    : 'bg-brand-surface text-brand-text-secondary hover:bg-brand-surface-2'
                }`}
              >
                {m === 'volume' ? 'Volume' : m === 'booked_pct' ? 'Bookings' : 'Response'}
              </button>
            ))}
          </div>
          <ExportButton csvData={csvData} csvFilename="hour_day_heatmap.csv" pngTargetRef={chartRef} pngFilename="hour_day_heatmap.png" />
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex ml-10">
            {HOURS.map((h) => (
              <div
                key={h}
                className="flex-1 text-center text-[9px] text-brand-text-muted font-medium pb-1"
              >
                {h % 3 === 0 ? formatHour(h) : ''}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {DAY_LABELS.map((dayName, dayIdx) => (
            <div key={dayIdx} className="flex items-center">
              <div className="w-10 text-xs text-brand-text-secondary font-medium text-right pr-2 shrink-0">
                {dayName}
              </div>
              <div className="flex flex-1 gap-[1px]">
                {HOURS.map((hour) => {
                  const cell = grid[`${dayIdx}-${hour}`];
                  if (!cell) return <div key={hour} className="flex-1 aspect-[1.6] rounded-sm bg-brand-surface-2" />;

                  let val = 0;
                  if (mode === 'volume') val = cell.volume;
                  else if (mode === 'booked_pct') val = cell.booked_pct;
                  else val = cell.median_resp_min ?? 0;

                  const bg = getColor(val, maxVal, mode);
                  const isAfterHours = cell.is_after_hours;

                  return (
                    <div
                      key={hour}
                      className={`flex-1 aspect-[1.6] rounded-sm cursor-pointer transition-all duration-100 ${
                        isAfterHours ? 'ring-1 ring-inset ring-brand-border/40' : ''
                      } ${hoveredCell === cell ? 'ring-2 ring-brand-primary scale-110 z-10' : ''}`}
                      style={{ backgroundColor: bg }}
                      onMouseEnter={() => setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {/* After-hours band indicator */}
          <div className="flex ml-10 mt-1">
            {HOURS.map((h) => (
              <div
                key={h}
                className={`flex-1 h-1 ${
                  h >= 22 || h < 8 ? 'bg-chart-rose/30 rounded-sm' : ''
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip / hover info */}
      <div className="mt-3 min-h-[40px]">
        {hoveredCell ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-text-secondary bg-brand-surface-2 rounded-btn px-3 py-2">
            <span className="font-medium text-brand-text">
              {hoveredCell.day_name} {hoveredCell.hour}:00
              {hoveredCell.is_after_hours && <span className="text-chart-rose ml-1">(after hours)</span>}
            </span>
            <span>{hoveredCell.volume} conversations</span>
            <span>{hoveredCell.engaged} engaged</span>
            <span>{hoveredCell.booked} booked ({hoveredCell.booked_pct}%)</span>
            {hoveredCell.median_resp_min !== null && (
              <span>Response: {hoveredCell.median_resp_min}m</span>
            )}
          </div>
        ) : (
          <div className="text-xs text-brand-text-muted italic px-3 py-2">
            Hover over a cell to see details
          </div>
        )}
      </div>

      {/* Legend + callouts */}
      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-brand-text-secondary">
        <div className="flex items-center gap-1.5">
          <div className="flex gap-[1px]">
            {[0.1, 0.3, 0.5, 0.7, 1].map((r) => (
              <div
                key={r}
                className="w-3 h-2 rounded-sm"
                style={{ backgroundColor: getColor(r * maxVal, maxVal, mode) }}
              />
            ))}
          </div>
          <span>{modeLabels[mode]}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm ring-1 ring-inset ring-brand-border/40 bg-brand-surface-2" />
          After hours (22:00-08:00)
        </div>
        {data.peak && (
          <span className="text-brand-text-muted">
            Peak: <strong className="text-brand-text">{data.peak.day_name} {data.peak.hour}:00</strong> ({data.peak.volume} convos)
          </span>
        )}
      </div>
    </div>
  );
};
