import mapboxgl from "mapbox-gl";
import type { SearchResult } from "../searchTypes";

// Marker color constants - Neobrutalist palette (complements neon green accent)
export const MARKER_COLORS = {
  station: "#00ffff", // Electric cyan for stations
  place: "#ffff00", // Neon yellow for AI places
  user: "#ff0000", // Bright red for user location
} as const;

/**
 * Create a custom neobrutalist marker element - black square with colored border
 */
function createMarkerElement(color: string, isStation: boolean): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "18px";
  el.style.height = "18px";
  el.style.position = "relative";
  el.style.transition = "none";

  // Black background with colored border
  el.style.background = "#000000";
  el.style.border = `3px solid ${color}`;
  el.style.boxShadow = `0 0 0 1px #000000`;

  // Store the color as CSS variable for selection state
  el.style.setProperty("--marker-color", color);
  el.dataset.markerColor = color;

  return el;
}

/**
 * Create markers for search results on the map
 * Returns array of created markers
 */
export function createMarkers(
  map: mapboxgl.Map,
  results: SearchResult[],
  onSelect?: (result: SearchResult) => void,
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

    const isStation = result.type === "station";
    const color = isStation ? MARKER_COLORS.station : MARKER_COLORS.place;
    const element = createMarkerElement(color, isStation);

    const marker = new mapboxgl.Marker({ element })
      .setLngLat(result.coordinates)
      .addTo(map);

    if (onSelect) {
      const markerEl = marker.getElement();
      markerEl.classList.add("search-marker");
      markerEl.dataset.resultId = result.id;
      markerEl.style.cursor = "pointer";
      markerEl.addEventListener("click", () => onSelect(result));
    }

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
