import React, { useState, useRef, useCallback } from 'react';
import type { DatePreset, FiltersResponse } from '../types';
import { importCSV } from '../api';

interface FilterBarProps {
  filters: FiltersResponse['data'] | null;
  brand: string;
  setBrand: (b: string) => void;
  country: string[];
  toggleCountry: (c: string) => void;
  workspace: string[];
  toggleWorkspace: (w: string) => void;
  datePreset: DatePreset;
  setDatePreset: (p: DatePreset) => void;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  onImportSuccess: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  brand,
  setBrand,
  country,
  toggleCountry,
  workspace,
  toggleWorkspace,
  datePreset,
  setDatePreset,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onImportSuccess,
}) => {
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importWorkspace, setImportWorkspace] = useState('');
  const [importBrand, setImportBrand] = useState('');
  const [importCountry, setImportCountry] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [countryOpen, setCountryOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const handleImport = useCallback(async () => {
    if (!importFile || !importWorkspace || !importBrand || !importCountry) {
      setImportError('All fields are required');
      return;
    }
    setImportLoading(true);
    setImportError('');
    setImportSuccess('');
    try {
      const result = await importCSV(importFile, importWorkspace, importBrand, importCountry);
      setImportSuccess(`Imported ${result.inserted ?? 0} threads successfully`);
      setImportFile(null);
      if (fileRef.current) fileRef.current.value = '';
      onImportSuccess();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImportLoading(false);
    }
  }, [importFile, importWorkspace, importBrand, importCountry, onImportSuccess]);

  const presetLabels: Record<DatePreset, string> = {
    this_month: 'This Month',
    last_30: 'Last 30 Days',
    ytd: 'Year to Date',
    custom: 'Custom Range',
  };

  return (
    <>
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-brand-border">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Preset */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">Date</label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                className="bg-brand-surface border border-brand-border text-brand-text text-sm rounded-btn px-3 py-1.5 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none transition-all duration-150"
              >
                {Object.entries(presetLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* Custom date inputs */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-brand-surface border border-brand-border text-brand-text text-sm rounded-btn px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-brand-primary/30 transition-all duration-150"
                />
                <span className="text-brand-text-muted text-sm">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-brand-surface border border-brand-border text-brand-text text-sm rounded-btn px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-brand-primary/30 transition-all duration-150"
                />
              </div>
            )}

            {/* Divider */}
            <div className="w-px h-6 bg-brand-border hidden sm:block" />

            {/* Brand */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">Brand</label>
              <select
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="bg-brand-surface border border-brand-border text-brand-text text-sm rounded-btn px-3 py-1.5 focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none transition-all duration-150"
              >
                <option value="">All Brands</option>
                {filters?.brands.map(b => (
                  <option key={b} value={b}>{filters.brand_labels[b] || b}</option>
                ))}
              </select>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-brand-border hidden sm:block" />

            {/* Country multi-select */}
            <div className="relative">
              <button
                onClick={() => { setCountryOpen(prev => !prev); setWorkspaceOpen(false); }}
                className="flex items-center gap-2 bg-brand-surface border border-brand-border text-brand-text text-sm rounded-btn px-3 py-1.5 hover:bg-brand-surface-2 transition-all duration-150"
              >
                <span className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">Country</span>
                <span className="text-brand-text">
                  {country.length === 0 ? 'All' : country.length === 1 ? country[0] : `${country.length} selected`}
                </span>
                <svg className={`w-3.5 h-3.5 text-brand-text-muted transition-transform duration-150 ${countryOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {countryOpen && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-brand-surface border border-brand-border rounded-btn shadow-card p-2 min-w-[160px]">
                  {filters?.countries.map(c => (
                    <label key={c} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-brand-surface-2 cursor-pointer transition-colors duration-150">
                      <input
                        type="checkbox"
                        checked={country.includes(c)}
                        onChange={() => toggleCountry(c)}
                        className="rounded border-brand-border bg-brand-surface text-brand-primary focus:ring-brand-primary"
                      />
                      <span className="text-sm text-brand-text">{c}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Workspace multi-select */}
            <div className="relative">
              <button
                onClick={() => { setWorkspaceOpen(prev => !prev); setCountryOpen(false); }}
                className="flex items-center gap-2 bg-brand-surface border border-brand-border text-brand-text text-sm rounded-btn px-3 py-1.5 hover:bg-brand-surface-2 transition-all duration-150"
              >
                <span className="text-xs font-medium text-brand-text-muted uppercase tracking-wider">Workspace</span>
                <span className="text-brand-text">
                  {workspace.length === 0 ? 'All' : workspace.length === 1 ? workspace[0] : `${workspace.length} selected`}
                </span>
                <svg className={`w-3.5 h-3.5 text-brand-text-muted transition-transform duration-150 ${workspaceOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {workspaceOpen && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-brand-surface border border-brand-border rounded-btn shadow-card p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                  {filters?.workspaces.map(w => (
                    <label key={w} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-brand-surface-2 cursor-pointer transition-colors duration-150">
                      <input
                        type="checkbox"
                        checked={workspace.includes(w)}
                        onChange={() => toggleWorkspace(w)}
                        className="rounded border-brand-border bg-brand-surface text-brand-primary focus:ring-brand-primary"
                      />
                      <span className="text-sm text-brand-text truncate">{w}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Import button */}
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-primary border border-brand-primary/30 bg-brand-primary-100 hover:bg-brand-primary/10 rounded-btn transition-all duration-150"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import CSV
            </button>
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-brand-surface border border-brand-border rounded-card shadow-card w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-brand-text font-display">Import CSV</h3>
              <button
                onClick={() => { setImportOpen(false); setImportError(''); setImportSuccess(''); }}
                className="text-brand-text-muted hover:text-brand-text transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">CSV File</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-brand-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-btn file:border-0 file:text-sm file:font-medium file:bg-brand-surface-2 file:text-brand-text hover:file:bg-brand-border file:transition-colors file:cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brand-text-secondary mb-1">Workspace</label>
                <input
                  type="text"
                  value={importWorkspace}
                  onChange={(e) => setImportWorkspace(e.target.value)}
                  placeholder="e.g. SA - National"
                  className="w-full bg-brand-surface border border-brand-border text-brand-text text-sm rounded-btn px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-brand-text-secondary mb-1">Brand</label>
                  <input
                    type="text"
                    value={importBrand}
                    onChange={(e) => setImportBrand(e.target.value)}
                    placeholder="e.g. abwaab"
                    className="w-full bg-brand-surface border border-brand-border text-brand-text text-sm rounded-btn px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-brand-text-secondary mb-1">Country</label>
                  <input
                    type="text"
                    value={importCountry}
                    onChange={(e) => setImportCountry(e.target.value)}
                    placeholder="e.g. KSA"
                    className="w-full bg-brand-surface border border-brand-border text-brand-text text-sm rounded-btn px-3 py-2 outline-none focus:ring-2 focus:ring-brand-primary/30"
                  />
                </div>
              </div>

              {importError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-btn px-3 py-2">
                  {importError}
                </div>
              )}
              {importSuccess && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-btn px-3 py-2">
                  {importSuccess}
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={importLoading}
                className="w-full py-2.5 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary-hover disabled:opacity-50 disabled:cursor-not-allowed rounded-btn transition-all duration-150"
              >
                {importLoading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
