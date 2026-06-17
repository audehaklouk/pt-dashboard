import { useState, useCallback, useMemo, useEffect } from 'react';
import type { FilterState, DatePreset } from '../types';

function getDateRange(preset: DatePreset, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');

  switch (preset) {
    case 'this_month': {
      const firstDay = `${yyyy}-${mm}-01`;
      const lastDay = new Date(yyyy, now.getMonth() + 1, 0);
      const to = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      return { from: firstDay, to };
    }
    case 'last_30': {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      const from = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      const to = `${yyyy}-${mm}-${String(now.getDate()).padStart(2, '0')}`;
      return { from, to };
    }
    case 'ytd': {
      return { from: `${yyyy}-01-01`, to: `${yyyy}-${mm}-${String(now.getDate()).padStart(2, '0')}` };
    }
    case 'custom':
      return { from: customFrom, to: customTo };
  }
}

function parseUrlParams(): Partial<FilterState> {
  const params = new URLSearchParams(window.location.search);
  const result: Partial<FilterState> = {};

  const brand = params.get('brand');
  if (brand) result.brand = brand;

  const country = params.get('country');
  if (country) result.country = country.split(',').filter(Boolean);

  const workspace = params.get('workspace');
  if (workspace) result.workspace = workspace.split(',').filter(Boolean);

  const preset = params.get('preset') as DatePreset | null;
  if (preset && ['this_month', 'last_30', 'ytd', 'custom'].includes(preset)) {
    result.datePreset = preset;
  }

  const dateFrom = params.get('date_from');
  if (dateFrom) result.dateFrom = dateFrom;

  const dateTo = params.get('date_to');
  if (dateTo) result.dateTo = dateTo;

  return result;
}

function syncToUrl(state: FilterState) {
  const params = new URLSearchParams();
  if (state.brand) params.set('brand', state.brand);
  if (state.country.length > 0) params.set('country', state.country.join(','));
  if (state.workspace.length > 0) params.set('workspace', state.workspace.join(','));
  params.set('preset', state.datePreset);
  if (state.datePreset === 'custom') {
    if (state.dateFrom) params.set('date_from', state.dateFrom);
    if (state.dateTo) params.set('date_to', state.dateTo);
  }
  const qs = params.toString();
  const newUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  window.history.replaceState(null, '', newUrl);
}

export function useFilters(dateMin: string, dateMax: string) {
  const urlState = useMemo(() => parseUrlParams(), []);

  const [brand, setBrand] = useState<string>(urlState.brand ?? '');
  const [country, setCountry] = useState<string[]>(urlState.country ?? []);
  const [workspace, setWorkspace] = useState<string[]>(urlState.workspace ?? []);
  const [datePreset, setDatePreset] = useState<DatePreset>(urlState.datePreset ?? 'ytd');
  const [dateFrom, setDateFrom] = useState<string>(urlState.dateFrom ?? dateMin);
  const [dateTo, setDateTo] = useState<string>(urlState.dateTo ?? dateMax);

  useEffect(() => {
    if (!urlState.dateFrom && dateMin) setDateFrom(dateMin);
    if (!urlState.dateTo && dateMax) setDateTo(dateMax);
  }, [dateMin, dateMax, urlState.dateFrom, urlState.dateTo]);

  const state: FilterState = useMemo(() => ({
    brand, country, workspace, datePreset, dateFrom, dateTo,
  }), [brand, country, workspace, datePreset, dateFrom, dateTo]);

  useEffect(() => {
    syncToUrl(state);
  }, [state]);

  const queryParams = useMemo((): Record<string, string> => {
    const range = getDateRange(datePreset, dateFrom, dateTo);
    const p: Record<string, string> = {};
    if (brand) p.brand = brand;
    if (country.length > 0) p.country = country.join(',');
    if (workspace.length > 0) p.workspace = workspace.join(',');
    if (range.from) p.date_from = range.from;
    if (range.to) p.date_to = range.to;
    return p;
  }, [brand, country, workspace, datePreset, dateFrom, dateTo]);

  const toggleCountry = useCallback((c: string) => {
    setCountry(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }, []);

  const toggleWorkspace = useCallback((w: string) => {
    setWorkspace(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]);
  }, []);

  return {
    brand, setBrand,
    country, toggleCountry, setCountry,
    workspace, toggleWorkspace, setWorkspace,
    datePreset, setDatePreset,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    queryParams,
  };
}
