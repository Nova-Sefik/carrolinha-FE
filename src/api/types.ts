// Mirrors carrolinha-api/app/schemas.py one-to-one. If the backend contract
// changes, change it here and TypeScript will point at every broken use.

export type OperatorId = "metro" | "carris" | "cm" | "rail" | "ferry" | "other";
export type SegmentId = "all" | "sub23" | "senior";

// ---------------------------------------------------------------- /api/meta
export interface Day {
  date: string;
  label: string;
  weekday: string;
  is_weekend: boolean;
}
export interface Operator {
  id: OperatorId;
  name: string;
  color: string;
  agency_codes: string[];
}
export interface Segment {
  id: SegmentId;
  label: string;
}
export interface HourLabel {
  hour: number;
  label: string;
}
export interface Scales {
  stop_boardings_max: number;
  hex_boardings_max: number;
  network_hour_max: number;
}
export interface LineRef {
  line_id: string;
  label: string;
  name: string;
  mode: "bus" | "ferry";
  operator: OperatorId;
}

export interface Meta {
  is_mock: boolean;
  week_start: string;
  week_end: string;
  note: string;
  days: Day[];
  hours: HourLabel[];
  operators: Operator[];
  segments: Segment[];
  hex_resolution: number;
  scales: Scales;
  lines: LineRef[];
}

// ------------------------------------------------------------ /api/overview
export interface Kpis {
  boardings: number;
  busiest_hour: number;
  transfers: number;
  alerts: number;
}
export interface OperatorShare {
  operator: OperatorId;
  boardings: number;
  share: number;
}
export interface HourValue {
  hour: number;
  boardings: number;
}
export interface InterchangeRef {
  stop_id: string;
  name: string;
  transfers: number;
}
export interface Overview {
  date: string;
  kpis: Kpis;
  operator_share: OperatorShare[];
  network_hourly: HourValue[];
  top_interchanges: InterchangeRef[];
}

// ----------------------------------------------------------------- /api/hex
export interface HexCell {
  h3: string;
  boardings: number;
  expected: number;
  ratio: number;
}
export interface HexResponse {
  date: string;
  hour: number;
  resolution: number;
  cells: HexCell[];
}

// --------------------------------------------------------------- /api/stops
export interface StopPoint {
  stop_id: string;
  name: string;
  lat: number;
  lon: number;
  operators: OperatorId[];
  boardings: number;
  expected: number;
  ratio: number;
}
export interface StopsResponse {
  date: string;
  hour: number;
  stops: StopPoint[];
}

// ----------------------------------------------------------- /api/stops/:id
export interface HourObsExp {
  hour: number;
  boardings: number;
  expected: number;
}
export interface WeekRow {
  date: string;
  weekday: string;
  hourly: number[];
}
export interface Facilities {
  shelter: boolean;
  step_free: boolean;
  realtime_display: boolean;
  wheelchair_boarding: boolean;
}
export interface NowValue {
  boardings: number;
  expected: number;
  deviation_pct: number;
}
export interface TransfersHere {
  transfers: number;
  worst_median_wait_min: number;
}
export interface StopDetail {
  stop_id: string;
  name: string;
  lat: number;
  lon: number;
  operators: OperatorId[];
  operator_stop_ids: Record<string, string[]>;
  date: string;
  hour: number;
  now: NowValue;
  hourly: HourObsExp[];
  week_grid: WeekRow[];
  mix: Record<"regular" | "sub23" | "senior", number>;
  facilities: Facilities;
  transfers_here: TransfersHere | null;
}

// -------------------------------------------------- /api/lines/:id/profile
export interface Vehicle {
  seats: number;
  standing: number;
  places: number;
  source: string;
}
export interface LineHour {
  hour: number;
  boardings: number;
  est_peak_load: number;
  trips: number;
  places_offered: number;
  load_factor: number;
}
export interface WhatIf {
  move_to_hours: number[];
  move_from_hours: number[];
  note: string;
}
export interface LineProfile {
  line_id: string;
  label: string;
  name: string;
  mode: "bus" | "ferry";
  operator: OperatorId;
  vehicle: Vehicle;
  shape: [number, number][]; // [lon, lat]
  date: string;
  hours: LineHour[];
  peak: { hour: number; load_factor: number };
  whatif: WhatIf;
}

// ----------------------------------------------------------- /api/transfers
export interface TransferPair {
  from_operator: OperatorId;
  to_operator: OperatorId;
  transfers: number;
  median_wait_min: number;
  p90_wait_min: number;
}
export interface Interchange {
  stop_id: string;
  name: string;
  lat: number;
  lon: number;
  transfers: number;
  worst_median_wait_min: number;
  fragile: boolean;
  pairs: TransferPair[];
  hourly: { hour: number; transfers: number }[];
}
export interface Flow {
  from_stop_id: string;
  from_name: string;
  from_lon: number;
  from_lat: number;
  to_stop_id: string;
  to_name: string;
  to_lon: number;
  to_lat: number;
  journeys: number;
  /** Hubs where people change vehicle, in order (draw from -> via... -> to). */
  via: Place[];
  /** Operator of each leg, in order. */
  modes: OperatorId[];
  /** Share of this origin-destination's journeys that follow this chain. */
  via_share: number | null;
}
export interface Place {
  stop_id: string;
  name: string;
  lat: number;
  lon: number;
}
export interface TransfersResponse {
  date: string;
  interchanges: Interchange[];
  flows: Flow[];
  method: string;
}

// ----------------------------------------------------------- /api/anomalies
export interface Alert {
  alert_id: string;
  stop_id: string;
  name: string;
  lat: number;
  lon: number;
  date: string;
  hour: number;
  observed: number;
  expected: number;
  deviation_pct: number;
  robust_z: number;
  direction: "above" | "below";
  hourly: { hour: number; observed: number; expected: number }[];
}
export interface AnomaliesResponse {
  alerts: Alert[];
  method: string;
}

// -------------------------------------------------------------- /api/golden
export interface GoldenLeg { operator: OperatorId; line_id: string; label: string; name: string }
export interface GoldenPath { legs: GoldenLeg[]; via: Place[]; journeys_per_day: number; share: number }
export interface GoldenReplaced {
  operator: OperatorId; line_id: string; label: string; name: string;
  riders_removed_per_day: number; line_riders_per_day: number; share_of_line: number | null;
}
export interface GoldenHub extends Place {
  transfers_removed_per_day: number; hub_boardings_per_day: number; share_of_hub: number | null;
}
export interface GoldenDirect { operator: OperatorId; line_id: string; label: string; name: string; journeys_per_day: number }
export interface GoldenFlag { level: "benefit" | "info" | "risk"; text: string }
export interface GoldenRoute {
  route_id: string;
  rank: number;
  from: Place;
  to: Place;
  distance_km: number;
  multi_per_day: number;
  direct_per_day: number;
  multi_share: number;
  avg_legs: number;
  current_min: number | null;
  projected_min: number;
  saved_min: number | null;
  riders_per_day: number;
  person_hours_per_day: number | null;
  peak_hour: number | null;
  peak_riders: number | null;
  trips_needed_peak: number | null;
  share_a_to_b: number | null;
  spike_z: number;
  verdict: "strong" | "viable" | "weak";
  flags: GoldenFlag[];
  hourly: { hour: number; journeys: number }[];
  paths: GoldenPath[];
  replaced: GoldenReplaced[];
  hubs: GoldenHub[];
  direct_lines: GoldenDirect[];
}
export interface GoldenResponse { routes: GoldenRoute[]; method: string; assumptions: Record<string, number> }
