"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import styles from "./MapView.module.scss";
import { invariant } from "@app/common";

interface MapViewProps {
  visibleLines: Record<string, boolean>;
  onMapLoad?: (map: mapboxgl.Map) => void;
}

// You'll need to get a free Mapbox token from https://mapbox.com
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function MapView({ visibleLines, onMapLoad }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapLoaded = useRef(false);

  useEffect(() => {
    if (map.current) return; // Initialize map only once

    invariant(mapContainer.current, "Map container ref must exist");
    invariant(MAPBOX_TOKEN, "NEXT_PUBLIC_MAPBOX_TOKEN environment variable must be set");

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-0.1276, 51.5074], // London coordinates
      zoom: 12,
    });

    map.current.on("load", () => {
      invariant(map.current, "Map must be initialized");

      // Add London Underground lines layer
      map.current.addSource("underground-lines", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [], // Will be populated with actual data
        },
      });

      map.current.addLayer({
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
            10, 2,
            14, 4,
            18, 8
          ],
          "line-opacity": 0.9,
        },
      });

      // Add London Underground stations layer
      map.current.addSource("underground-stations", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [], // Will be populated with actual data
        },
      });

      map.current.addLayer({
        id: "underground-stations-layer",
        type: "circle",
        source: "underground-stations",
        paint: {
          "circle-radius": [
            "interpolate",
            ["exponential", 1.5],
            ["zoom"],
            10, 2,
            14, 4,
            18, 6
          ],
          "circle-color": "#fff",
          "circle-stroke-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10, 1,
            14, 1.5,
            18, 2
          ],
          "circle-stroke-color": "#000",
        },
      });

      map.current.addLayer({
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
      });

      // Mark map as loaded
      mapLoaded.current = true;

      // Notify parent component that map is loaded
      if (onMapLoad) {
        onMapLoad(map.current);
      }

      // Load TfL data (in next step)
      loadUndergroundData(map.current);
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map.current || !mapLoaded.current) return;

    // Get list of visible line names
    const visibleLineNames = Object.entries(visibleLines)
      .filter(([_, isVisible]) => isVisible)
      .map(([lineName]) => lineName);

    // Create filter expression for lines
    // Show lines where the "name" property matches any visible line
    const lineFilter =
      visibleLineNames.length > 0
        ? ["in", ["get", "name"], ["literal", visibleLineNames]]
        : ["==", ["get", "name"], ""];

    // Create filter expression for stations
    // Show stations where at least one of their lines is visible
    const stationFilter =
      visibleLineNames.length > 0
        ? [
            "any",
            ...visibleLineNames.map((lineName) => [
              "in",
              lineName,
              ["get", "lines"],
            ]),
          ]
        : ["==", ["get", "name"], ""];

    // Apply filters to layers
    if (map.current.getLayer("underground-lines-layer")) {
      map.current.setFilter("underground-lines-layer", lineFilter);
    }
    if (map.current.getLayer("underground-stations-layer")) {
      map.current.setFilter("underground-stations-layer", stationFilter);
    }
    if (map.current.getLayer("underground-stations-labels")) {
      map.current.setFilter("underground-stations-labels", stationFilter);
    }
  }, [visibleLines]);

  return <div ref={mapContainer} className={styles.map} />;
}

async function loadUndergroundData(map: mapboxgl.Map) {
  try {
    // Fetch TfL London Underground data
    // For now, using a simplified sample - in production you'd fetch from TfL API
    const lines = await fetch("/api/underground/lines").then((r) => r.json());
    const stations = await fetch("/api/underground/stations").then((r) => r.json());

    const linesSource = map.getSource("underground-lines") as mapboxgl.GeoJSONSource;
    const stationsSource = map.getSource("underground-stations") as mapboxgl.GeoJSONSource;

    if (linesSource) {
      linesSource.setData(lines);
    }

    if (stationsSource) {
      stationsSource.setData(stations);
    }
  } catch (error) {
    console.error("Failed to load underground data:", error);
  }
}
