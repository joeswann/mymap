import type mapboxgl from "mapbox-gl";

/**
 * Create the London Underground lines layer configuration - Neobrutalist style
 */
export function createLineLayerConfig(): mapboxgl.AnyLayer {
  return {
    id: "underground-lines-layer",
    type: "line",
    source: "underground-lines",
    layout: {
      "line-join": "miter", // Sharp corners, not rounded
      "line-cap": "square", // Square caps, not rounded
    },
    paint: {
      "line-color": ["get", "colour"],
      "line-width": [
        "interpolate",
        ["exponential", 1.5],
        ["zoom"],
        10,
        3, // Thicker lines
        14,
        6,
        18,
        12,
      ],
      "line-opacity": 1, // Full opacity for bold look
    },
  };
}

/**
 * Create an outer stroke layer for the Underground lines - Neobrutalist border effect
 */
export function createLineOuterStrokeConfig(): mapboxgl.AnyLayer {
  return {
    id: "underground-lines-stroke",
    type: "line",
    source: "underground-lines",
    layout: {
      "line-join": "miter",
      "line-cap": "square",
    },
    paint: {
      "line-color": "#000000", // Black outline
      "line-width": [
        "interpolate",
        ["exponential", 1.5],
        ["zoom"],
        10,
        4, // Slightly wider than the main line
        14,
        8,
        18,
        15,
      ],
      "line-opacity": 1,
    },
  };
}

/**
 * Create the London Underground stations layer configuration - Neobrutalist squares
 */
export function createStationCircleConfig(): mapboxgl.AnyLayer {
  return {
    id: "underground-stations-layer",
    type: "circle",
    source: "underground-stations",
    paint: {
      "circle-radius": [
        "interpolate",
        ["exponential", 1.5],
        ["zoom"],
        10,
        3, // Larger stations
        14,
        5,
        18,
        8,
      ],
      "circle-color": "#ffffff", // White fill
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        2, // Thicker borders
        14,
        3,
        18,
        4,
      ],
      "circle-stroke-color": "#000000", // Black border
      "circle-pitch-alignment": "map", // Makes it square-looking at angles
    },
  };
}

/**
 * Create an outer glow for stations - Neobrutalist highlight
 */
export function createStationGlowConfig(): mapboxgl.AnyLayer {
  return {
    id: "underground-stations-glow",
    type: "circle",
    source: "underground-stations",
    paint: {
      "circle-radius": [
        "interpolate",
        ["exponential", 1.5],
        ["zoom"],
        10,
        5,
        14,
        8,
        18,
        12,
      ],
      "circle-color": "#00ffff", // Electric cyan glow
      "circle-opacity": 0.25,
      "circle-blur": 1,
    },
  };
}

/**
 * Create the London Underground stations label layer configuration - Neobrutalist typography
 */
export function createStationLabelConfig(): mapboxgl.AnyLayer {
  return {
    id: "underground-stations-labels",
    type: "symbol",
    source: "underground-stations",
    layout: {
      "text-field": ["get", "displayName"],
      "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"], // Bolder font
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        9, // Smaller at low zoom
        14,
        11,
        18,
        14,
      ],
      "text-offset": [0, 1.8],
      "text-anchor": "top",
      "text-transform": "uppercase", // All caps for brutalist feel
      "text-letter-spacing": 0.05, // Slightly spaced out
    },
    paint: {
      "text-color": "#ffffff", // White text (inverted for dark theme)
      "text-halo-color": "#000000", // Black halo
      "text-halo-width": 3, // Thicker halo for readability
      "text-halo-blur": 0, // Sharp halo, no blur
    },
  };
}
