import React, { useEffect, useState, useRef, useCallback } from 'react';
import { fetchFilters, fetchThreads } from './api';
import { useFilters } from './hooks/useFilters';
import type { FiltersResponse, ThreadsData } from './types';
import { FilterBar } from './components/FilterBar';
import { HeadlineTiles } from './components/HeadlineTiles';
import { ChatPanel } from './components/ChatPanel';
import { DropoffMap } from './components/DropoffMap';
import { PaymentContinuation } from './components/PaymentContinuation';
import { ObjectionsChart } from './components/ObjectionsChart';
import { CapabilitiesChart } from './components/CapabilitiesChart';
import { ResponseSLA } from './components/ResponseSLA';
import { BuyerType } from './components/BuyerType';
import { ResponseByHour } from './components/ResponseByHour';
import { SpeedConversion } from './components/SpeedConversion';
import { SegmentHealth } from './components/SegmentHealth';
import { WeeklyTrend } from './components/WeeklyTrend';
import { PaymentJourney } from './components/PaymentJourney';
import { AutoInsights } from './components/AutoInsights';
import { BuyReadiness } from './components/BuyReadiness';
import { TopicInsights } from './components/TopicInsights';
import { DemandDrivers } from './components/DemandDrivers';
import { KeyInsights } from './components/KeyInsights';
import { HourDayHeatmap } from './components/HourDayHeatmap';

function formatDateRange(min: string, max: string): string {
  const fmt = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  return `${fmt(min)} \u2013 ${fmt(max)}`;
}

export function App() {
  const [filtersData, setFiltersData] = useState<FiltersResponse['data'] | null>(null);
  const [threadsData, setThreadsData] = useState<ThreadsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const {
    brand, setBrand,
    country, toggleCountry,
    workspace, toggleWorkspace,
    datePreset, setDatePreset,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    queryParams,
  } = useFilters(filtersData?.date_min ?? '', filtersData?.date_max ?? '');

  useEffect(() => {
    fetchFilters()
      .then((res: FiltersResponse) => setFiltersData(res.data))
      .catch((err) => setError(err.message));
  }, [refreshKey]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError(null);
      fetchThreads(queryParams)
        .then((res) => {
          if (res.error) {
            setError(res.error);
            setThreadsData(null);
          } else {
            setThreadsData(res.data);
          }
        })
        .catch((err) => {
          setError(err.message);
          setThreadsData(null);
        })
        .finally(() => setLoading(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [queryParams, refreshKey]);

  const handleImportSuccess = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const engagedN = threadsData?.engaged_n ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg">
      {/* Header */}
      <header className="border-b border-brand-border bg-brand-surface shadow-card">
        <div className="max-w-[1600px] mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[22px] font-bold text-brand-text tracking-tight font-display">
              PT Conversation Dashboard
            </h1>
            <p className="text-sm text-brand-text-secondary mt-0.5">
              Respond conversation analytics
            </p>
          </div>
          <div className="flex items-center gap-4">
            {filtersData && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-brand-primary-100 rounded-btn text-xs font-medium text-brand-primary">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDateRange(filtersData.date_min, filtersData.date_max)}
              </div>
            )}
            {threadsData && (
              <div className="text-sm text-brand-text-muted font-medium">
                {threadsData.engaged_n.toLocaleString('en-US')} engaged
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <FilterBar
        filters={filtersData}
        brand={brand}
        setBrand={setBrand}
        country={country}
        toggleCountry={toggleCountry}
        workspace={workspace}
        toggleWorkspace={toggleWorkspace}
        datePreset={datePreset}
        setDatePreset={setDatePreset}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        onImportSuccess={handleImportSuccess}
      />

      {/* Main content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 py-6 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-card px-4 py-3 text-sm text-red-700">
            <span className="font-medium">Error:</span> {error}
          </div>
        )}

        {/* Key Insights — written analysis at top */}
        <KeyInsights />

        {/* Headline Tiles */}
        <HeadlineTiles
          data={loading ? null : threadsData?.headlines ?? null}
          engagedN={loading ? null : engagedN}
        />

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ask the Data — full width */}
          <div id="panel-funnel" className="lg:col-span-2 scroll-mt-20">
            <ChatPanel />
          </div>

          {/* Drop-off Map */}
          <DropoffMap
            data={loading ? null : threadsData?.dropoff ?? null}
            engagedN={loading ? null : engagedN}
          />

          {/* Payment Continuation */}
          <div id="panel-payment" className="scroll-mt-20">
            <PaymentContinuation
              data={loading ? null : threadsData?.payment ?? null}
              engagedN={loading ? null : engagedN}
            />
          </div>

          {/* Objections */}
          <ObjectionsChart
            data={loading ? null : threadsData?.objections ?? null}
            engagedN={loading ? null : engagedN}
          />

          {/* Capabilities */}
          <div id="panel-capabilities" className="scroll-mt-20">
            <CapabilitiesChart
              data={loading ? null : threadsData?.capabilities ?? null}
              engagedN={loading ? null : engagedN}
            />
          </div>

          {/* Response SLA — full width */}
          <div id="panel-response-sla" className="lg:col-span-2 scroll-mt-20">
            <ResponseSLA
              data={loading ? null : threadsData?.response_sla ?? null}
              engagedN={loading ? null : engagedN}
            />
          </div>

          {/* Buyer Type */}
          <BuyerType
            data={loading ? null : threadsData?.buyer_type ?? null}
            engagedN={loading ? null : engagedN}
          />
        </div>

        {/* Deeper Insights Section */}
        <div className="pt-4">
          <h2 className="text-xl font-bold text-brand-text font-display mb-6">Deeper Insights</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Buy Readiness */}
            <div id="panel-buy-readiness" className="scroll-mt-20">
              <BuyReadiness
                data={loading ? null : threadsData?.buy_readiness ?? null}
                engagedN={loading ? null : engagedN}
              />
            </div>

            {/* Payment Journey */}
            <PaymentJourney
              data={loading ? null : threadsData?.payment_journey ?? null}
              engagedN={loading ? null : engagedN}
            />

            {/* Response by Hour */}
            <div id="panel-response-by-hour" className="scroll-mt-20">
              <ResponseByHour
                data={loading ? null : threadsData?.response_by_hour ?? null}
              />
            </div>

            {/* Speed → Conversion */}
            <SpeedConversion
              data={loading ? null : threadsData?.speed_conversion ?? null}
            />

            {/* Hour × Day Heatmap — full width */}
            <div className="lg:col-span-2">
              <HourDayHeatmap
                data={loading ? null : threadsData?.hour_day_heatmap ?? null}
                engagedN={loading ? null : engagedN}
              />
            </div>

            {/* Demand Drivers — full width */}
            <div id="panel-demand-drivers" className="lg:col-span-2 scroll-mt-20">
              <DemandDrivers
                data={loading ? null : threadsData?.demand_drivers ?? null}
                engagedN={loading ? null : engagedN}
              />
            </div>

            {/* Weekly Trend — full width */}
            <div className="lg:col-span-2">
              <WeeklyTrend
                data={loading ? null : threadsData?.weekly_trend ?? null}
              />
            </div>

            {/* Segment Health — full width */}
            <div id="panel-segment-health" className="lg:col-span-2 scroll-mt-20">
              <SegmentHealth
                data={loading ? null : threadsData?.segment_health ?? null}
              />
            </div>

            {/* Topic Insights — full width */}
            <div id="panel-topic-insights" className="lg:col-span-2 scroll-mt-20">
              <TopicInsights
                data={loading ? null : threadsData?.topic_insights ?? null}
                engagedN={loading ? null : engagedN}
              />
            </div>

            {/* Auto Insights — full width */}
            <div className="lg:col-span-2">
              <AutoInsights
                data={loading ? null : threadsData?.auto_insights ?? null}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer disclaimer */}
      <footer className="border-t border-brand-border bg-brand-surface">
        <div className="max-w-[1600px] mx-auto px-4 py-4">
          <p className="text-xs text-brand-text-muted italic text-center leading-relaxed">
            Covers only people who already messaged us &mdash; conversion &amp; product signal, not acquisition.
            &lsquo;Booked&rsquo; is a lower-bound proxy, not a close rate.
          </p>
        </div>
      </footer>
    </div>
  );
}
