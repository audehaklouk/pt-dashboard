import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';

interface ExportButtonProps {
  csvData: () => string;
  csvFilename: string;
  pngTargetRef: React.RefObject<HTMLDivElement | null>;
  pngFilename: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  csvData,
  csvFilename,
  pngTargetRef,
  pngFilename,
}) => {
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const downloadCSV = useCallback(() => {
    const blob = new Blob([csvData()], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFilename;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }, [csvData, csvFilename]);

  const downloadPNG = useCallback(async () => {
    if (!pngTargetRef.current) return;
    try {
      const dataUrl = await toPng(pngTargetRef.current, {
        backgroundColor: '#FFFFFF',
        pixelRatio: 2,
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = pngFilename;
      a.click();
    } catch (err) {
      console.error('PNG export failed:', err);
    }
    setOpen(false);
  }, [pngTargetRef, pngFilename]);

  return (
    <div className="relative" ref={dropRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-brand-text-secondary hover:text-brand-text bg-brand-surface-2 hover:bg-brand-border border border-brand-border rounded-btn transition-all duration-150"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-brand-surface border border-brand-border rounded-btn shadow-card overflow-hidden min-w-[140px]">
          <button
            onClick={downloadCSV}
            className="w-full text-left px-3 py-2 text-xs text-brand-text-secondary hover:bg-brand-surface-2 hover:text-brand-text transition-colors duration-150"
          >
            Download CSV
          </button>
          <button
            onClick={downloadPNG}
            className="w-full text-left px-3 py-2 text-xs text-brand-text-secondary hover:bg-brand-surface-2 hover:text-brand-text transition-colors duration-150"
          >
            Download PNG
          </button>
        </div>
      )}
    </div>
  );
};
