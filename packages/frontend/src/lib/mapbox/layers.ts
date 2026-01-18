import type mapboxgl from "mapbox-gl";

/**
 * Create the London Underground lines layer configuration
 */
export function createLineLayerConfig(): mapboxgl.AnyLayer {
  return {
    id: "underground-lines-layer",
    type: "line",
    source: "underground-lines",
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": ["get", "colour"],
      "line-width": [
        "interpolate",
        ["exponential", 1.5],
        ["zoom"],
        10,
        2,
        14,
        4,
        18,
        8,
      ],
      "line-opacity": 0.9,
    },
  };
}

/**
 * Create the London Underground stations circle layer configuration
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
        2,
        14,
        4,
        18,
        6,
      ],
      "circle-color": "#fff",
      "circle-stroke-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        1,
        14,
        1.5,
        18,
        2,
      ],
      "circle-stroke-color": "#000",
    },
  };
}

/**
 * Create the London Underground stations label layer configuration
 */
export function createStationLabelConfig(): mapboxgl.AnyLayer {
  return {
    id: "underground-stations-labels",
    type: "symbol",
    source: "underground-stations",
    layout: {
      "text-field": ["get", "displayName"],
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-size": 11,
      "text-offset": [0, 1.5],
      "text-anchor": "top",
    },
    paint: {
      "text-color": "#000",
      "text-halo-color": "#fff",
      "text-halo-width": 2,
    },
  };
}
