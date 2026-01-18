"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import styles from "./MapView.module.scss";
import { invariant } from "@app/common";
import { useGeolocation } from "~/hooks/useGeolocation";
import { fetchUndergroundLines, fetchUndergroundStations } from "~/lib/api";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "~/lib/constants";
import {
  createLineLayerConfig,
  createStationCircleConfig,
  createStationLabelConfig,
} from "~/lib/mapbox/layers";
import { createLineFilter, createStationFilter } from "~/lib/mapbox/filters";

interface MapViewProps {
  visibleLines: Record<string, boolean>;
  onMapLoad?: (map: mapboxgl.Map) => void;
  onLocationChange?: (location: { latitude: number; longitude: number } | null) => void;
}

export default function MapView({
  visibleLines,
  onMapLoad,
  onLocationChange,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapLoaded = useRef(false);
  const userMarker = useRef<mapboxgl.Marker | null>(null);
  const dataLoadController = useRef<AbortController | null>(null);
  const visibleLinesRef = useRef(visibleLines);

  // Use geolocation hook
  const { location: userLocation, requestLocation } = useGeolocation(map);

  useEffect(() => {
    visibleLinesRef.current = visibleLines;
  }, [visibleLines]);

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Initialize map only once

    invariant(mapContainer.current, "Map container ref must exist");
    invariant(
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      "NEXT_PUBLIC_MAPBOX_TOKEN environment variable must be set"
    );

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11", // Dark mode style
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.current.on("load", () => {
      invariant(map.current, "Map must be initialized");

      // Add London Underground lines source and layer
      map.current.addSource("underground-lines", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
      map.current.addLayer(createLineLayerConfig());

      // Add London Underground stations source and layers
      map.current.addSource("underground-stations", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
      map.current.addLayer(createStationCircleConfig());
      map.current.addLayer(createStationLabelConfig());

      const initialVisibleLineNames = Object.entries(visibleLinesRef.current)
        .filter(([_, isVisible]) => isVisible)
        .map(([lineName]) => lineName);
      const lineFilter = createLineFilter(initialVisibleLineNames);
      const stationFilter = createStationFilter(initialVisibleLineNames);
      map.current.setFilter("underground-lines-layer", lineFilter);
      map.current.setFilter("underground-stations-layer", stationFilter);
      map.current.setFilter("underground-stations-labels", stationFilter);

      // Mark map as loaded
      mapLoaded.current = true;

      // Notify parent component that map is loaded
      if (onMapLoad) {
        onMapLoad(map.current);
      }

      // Load TfL data
      dataLoadController.current?.abort();
      dataLoadController.current = new AbortController();
      loadUndergroundData(map.current, dataLoadController.current.signal);

      // Request user location and center map if available
      requestLocation(true);
    });

    return () => {
      dataLoadController.current?.abort();
      dataLoadController.current = null;
      mapLoaded.current = false;
      map.current?.remove();
      map.current = null;
      userMarker.current = null;
    };
  }, [onMapLoad, requestLocation]);

  // Update user marker when location changes
  useEffect(() => {
    if (!map.current || !userLocation) return;

    const coordinates: [number, number] = [
      userLocation.longitude,
      userLocation.latitude,
    ];

    if (!userMarker.current) {
      const markerEl = document.createElement("div");
      markerEl.className = styles.userMarker;
      userMarker.current = new mapboxgl.Marker({ element: markerEl })
        .setLngLat(coordinates)
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat(coordinates);
    }
  }, [userLocation]);

  useEffect(() => {
    if (!onLocationChange) return;
    onLocationChange(userLocation);
  }, [onLocationChange, userLocation]);

  // Update filters when visible lines change
  useEffect(() => {
    if (!map.current || !mapLoaded.current) return;

    // Get list of visible line names
    const visibleLineNames = Object.entries(visibleLines)
      .filter(([_, isVisible]) => isVisible)
      .map(([lineName]) => lineName);

    // Create filter expressions
    const lineFilter = createLineFilter(visibleLineNames);
    const stationFilter = createStationFilter(visibleLineNames);

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

  return (
    <div className={styles.mapWrapper}>
      <div ref={mapContainer} className={styles.map} />
      <button
        type="button"
        className={styles.locateButton}
        onClick={() => requestLocation(true)}
        aria-label="Recenter map to your location"
      >
        Me
      </button>
    </div>
  );
}

/**
 * Load Underground data from API and update map sources
 */
async function loadUndergroundData(
  map: mapboxgl.Map,
  signal?: AbortSignal
) {
  try {
    const [lines, stations] = await Promise.all([
      fetchUndergroundLines(signal),
      fetchUndergroundStations(signal),
    ]);

    const linesSource = map.getSource("underground-lines") as mapboxgl.GeoJSONSource;
    const stationsSource = map.getSource(
      "underground-stations"
    ) as mapboxgl.GeoJSONSource;

    if (linesSource) {
      linesSource.setData(lines);
    }

    if (stationsSource) {
      stationsSource.setData(stations);
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "AbortError"
    ) {
      return;
    }
    console.error("Failed to load underground data:", error);
  }
}
