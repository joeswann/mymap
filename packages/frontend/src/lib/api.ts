import type { TflLineCollection, TflStationCollection } from "./tflTypes";
import type { ParsedQuery, AiSearchResult } from "./searchTypes";
import type { Coordinates } from "./geocoding";

// Search response type
export interface SearchResponse {
  parsedQuery: ParsedQuery;
  results: AiSearchResult[];
}

/**
 * Fetch London Underground lines data
 * Returns GeoJSON FeatureCollection of line geometries
 */
export async function fetchUndergroundLines(
  signal?: AbortSignal
): Promise<TflLineCollection> {
  const response = await fetch("/api/underground/lines", { signal });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch underground lines: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Fetch London Underground stations data
 * Returns GeoJSON FeatureCollection of station points
 */
export async function fetchUndergroundStations(
  signal?: AbortSignal
): Promise<TflStationCollection> {
  const response = await fetch("/api/underground/stations", { signal });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch underground stations: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Perform AI-powered search for places
 * Optionally includes user location for better results
 */
export async function fetchSearch(
  query: string,
  location?: Coordinates
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });

  if (location) {
    params.set("lat", String(location.latitude));
    params.set("lng", String(location.longitude));
  }

  const response = await fetch(`/api/search?${params}`);

  if (!response.ok) {
    throw new Error(
      `Search failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}
