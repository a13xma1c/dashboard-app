/** localStorage keys used to persist dashboard state across reloads. */
export const PROPERTY_STORAGE_KEY = "ga_property_id";
export const DATE_RANGE_STORAGE_KEY = "ga_date_range";

/** URL query-string keys that mirror the dashboard state (shareable links). */
export const URL_PARAMS = { property: "property", start: "start", end: "end" } as const;
