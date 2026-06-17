export interface FiltersResponse {
  data: {
    workspaces: string[];
    brands: string[];
    brand_labels: Record<string, string>;
    countries: string[];
    date_min: string;
    date_max: string;
  };
}

export interface Headlines {
  threads: number;
  twoway_rate: number;
  paylink_reach_pct: number;
  booked_pct: number;
  median_first_resp_min: number | null;
}

export interface Funnel {
  threads: number;
  inbound: number;
  twoway: number;
  reached_price: number;
  paylink: number;
  booked: number;
  inb_pct: number;
  tw_pct_inb: number;
  price_pct_tw: number;
  pl_pct_tw: number;
  bk_pct_tw: number;
}

export interface DropoffItem {
  event: string;
  n: number;
  dark: number;
  pct: number;
}

export interface Payment {
  paylinks: number;
  dark: number;
  dark_pct: number;
  continued: number;
  cont_pct: number;
  booked_of_link: number;
  booked_of_link_pct: number;
}

export interface ObjectionItem {
  key: string;
  label: string;
  count: number;
  pct: number;
}

export interface CapabilityItem {
  key: string;
  label: string;
  count: number;
}

export interface ResponseSLAItem {
  workspace: string;
  median_min: number | null;
  p90_min: number | null;
  noreply_pct: number;
  n_first: number;
}

export interface BuyerType {
  parent: number;
  student: number;
  unknown: number;
  parent_pct: number;
  student_pct: number;
  unknown_pct: number;
}

// Deeper insight types

export interface PaymentJourneyData {
  reached_price: number;
  got_link: number;
  booked: number;
  price_to_link_pct: number;
  link_to_booked_pct: number;
  price_to_booked_pct: number;
}

export interface ResponseByHourItem {
  hour: number;
  median_min: number | null;
  count: number;
  is_after_hours: boolean;
}

export interface ResponseByHourData {
  hours: ResponseByHourItem[];
  after_hours_share: number;
  after_hours_median: number | null;
}

export interface SpeedConversionItem {
  bucket: string;
  n: number;
  booked: number;
  booked_pct: number;
}

export interface SegmentHealthItem {
  workspace: string;
  n: number;
  twoway_pct: number;
  paylink_reach_pct: number;
  booked_pct: number;
  median_resp_min: number | null;
}

export interface WeeklyTrendItem {
  week: string;
  inbound: number;
  booked: number;
}

// Buy readiness
export interface BuyReadinessData {
  implicit_ready: number;
  explicit_ask: number;
  ready_no_link: number;
  engaged_n: number;
  implicit_pct: number;
  explicit_pct: number;
}

// Topic insights
export interface TopicFreqItem {
  key: string;
  label: string;
  converted_pct: number;
  leaked_pct: number;
  gap: number;
  converted_n: number;
  leaked_n: number;
}

export interface TrialStates {
  offered: number;
  requested: number;
  completed: number;
  offered_pct: number;
  requested_pct: number;
  completed_pct: number;
}

export interface ConvertingCombo {
  pair: string;
  n: number;
  reach_rate: number;
  lift: number;
}

export interface TopicInsightsData {
  topic_freq: TopicFreqItem[];
  trial_states: TrialStates;
  converting_combos: ConvertingCombo[];
  base_reach_rate: number;
  n_converted: number;
  n_leaked: number;
}

// Demand drivers
export interface DemandDriversData {
  overall_bk_pct: number;
  exam_share: number;
  exam_bk_pct: number;
  exam_lift: number;
  exam_n: number;
  trial_share: number;
  trial_bk_pct: number;
  trial_n: number;
  parent_share: number;
  parent_bk_pct: number;
  parent_n: number;
}

export interface ThreadsData {
  engaged_n: number;
  headlines: Headlines;
  funnel: Funnel;
  dropoff: DropoffItem[];
  payment: Payment;
  objections: ObjectionItem[];
  capabilities: CapabilityItem[];
  response_sla: ResponseSLAItem[];
  buyer_type: BuyerType;
  // Deeper insights
  payment_journey: PaymentJourneyData;
  response_by_hour: ResponseByHourData;
  speed_conversion: SpeedConversionItem[];
  segment_health: SegmentHealthItem[];
  weekly_trend: WeeklyTrendItem[];
  buy_readiness: BuyReadinessData;
  topic_insights: TopicInsightsData;
  demand_drivers: DemandDriversData;
  auto_insights: InsightSection[];
}

export interface InsightItem {
  text: string;
  type: 'positive' | 'negative' | 'neutral' | 'opportunity';
}

export interface InsightSection {
  title: string;
  icon: string;
  items: InsightItem[];
}

export interface ThreadsResponse {
  data: ThreadsData;
  error: string | null;
}

export type DatePreset = 'this_month' | 'last_30' | 'ytd' | 'custom';

export interface FilterState {
  brand: string;
  country: string[];
  workspace: string[];
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
}
