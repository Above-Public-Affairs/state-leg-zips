export interface DistrictInfo {
  name: string;
  // Default copy list: ZIPs with at least `zip_share_threshold` of their
  // residents in the district.
  zips: string[];
  // ZIPs that touch the district but fall below the threshold, or have no
  // residents. zips + spillover is every ZIP the Census lists for the district.
  spillover: string[];
  // ZIP -> state abbreviation, for ZIPs whose residents mostly live in
  // another state.
  crossState?: Record<string, string>;
  // Share of district residents living in `zips` (0-1).
  coverage: number;
}

export interface ChamberData {
  districts: Record<string, DistrictInfo>;
}

export interface StateData {
  name: string;
  abbreviation: string;
  chambers: {
    upper?: ChamberData;
    lower?: ChamberData;
  };
}

export interface DistrictData {
  states: Record<string, StateData>;
  metadata: {
    generatedAt: string;
    source: string;
    zcta_vintage: string;
    legislative_session: string;
    population_source: string;
    zip_share_threshold: number;
  };
}

export type StateUpdates = Record<string, string>;
