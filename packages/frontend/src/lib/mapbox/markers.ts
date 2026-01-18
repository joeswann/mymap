import mapboxgl from "mapbox-gl";
import type { SearchResult } from "../searchTypes";

// Marker color constants
export const MARKER_COLORS = {
  station: "#0ea5e9", // Light blue for stations
  place: "#a78bfa", // Purple for AI places (updated for dark mode)
  user: "#ef4444", // Red for user location
} as const;

/**
 * Create markers for search results on the map
 * Returns array of created markers
 */
export function createMarkers(
  map: mapboxgl.Map,
  results: SearchResult[]
): mapboxgl.Marker[] {
  const markers: mapboxgl.Marker[] = [];

  results.forEach((result) => {
    // Skip intent results (no coordinates)
    if (result.type === "intent") {
      return;
    }

    // Skip results without coordinates
    if (!result.coordinates) {
      return;
    }

    const color = result.type === "station" ? MARKER_COLORS.station : MARKER_COLORS.place;
    const marker = new mapboxgl.Marker({ color })
      .setLngLat(result.coordinates)
      .addTo(map);

    markers.push(marker);
  });

  return markers;
}

/**
 * Clear all markers from the map
 */
export function clearMarkers(markers: mapboxgl.Marker[]): void {
  markers.forEach((marker) => marker.remove());
}
