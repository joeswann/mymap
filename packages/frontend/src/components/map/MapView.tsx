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
  createLineOuterStrokeConfig,
  createStationCircleConfig,
  createStationGlowConfig,
  createStationLabelConfig,
} from "~/lib/mapbox/layers";
import { createLineFilter, createStationFilter } from "~/lib/mapbox/filters";

interface MapViewProps {
  visibleLines: Record<string, boolean>;
  onMapLoad?: (map: mapboxgl.Map) => void;
  onLocationChange?: (
    location: { latitude: number; longitude: number } | null,
  ) => void;
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
      "NEXT_PUBLIC_MAPBOX_TOKEN environment variable must be set",
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

      // Add London Underground lines source and layers (stroke first, then main line)
      map.current.addSource("underground-lines", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
      map.current.addLayer(createLineOuterStrokeConfig()); // Black outline
      map.current.addLayer(createLineLayerConfig()); // Colored line on top

      // Add London Underground stations source and layers (glow first, then circle, then labels)
      map.current.addSource("underground-stations", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
      map.current.addLayer(createStationGlowConfig()); // Cyan glow
      map.current.addLayer(createStationCircleConfig()); // White circle with black border
      map.current.addLayer(createStationLabelConfig()); // Labels on top

      const initialVisibleLineNames = Object.entries(visibleLinesRef.current)
        .filter(([_, isVisible]) => isVisible)
        .map(([lineName]) => lineName);
      const lineFilter = createLineFilter(initialVisibleLineNames);
      const stationFilter = createStationFilter(initialVisibleLineNames);
      map.current.setFilter("underground-lines-layer", lineFilter);
      map.current.setFilter("underground-lines-stroke", lineFilter);
      map.current.setFilter("underground-stations-layer", stationFilter);
      map.current.setFilter("underground-stations-glow", stationFilter);
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
      userLocation.coordinates.longitude,
      userLocation.coordinates.latitude,
    ];

    const hasHeading = userLocation.heading !== null;

    if (!userMarker.current) {
      const markerEl = document.createElement("div");
      // Use arrow class if compass available, square otherwise
      markerEl.className = hasHeading ? styles.userMarkerArrow : styles.userMarker;
      userMarker.current = new mapboxgl.Marker({ element: markerEl })
        .setLngLat(coordinates)
        .addTo(map.current);
    } else {
      userMarker.current.setLngLat(coordinates);

      // Update marker class if heading availability changed
      const markerEl = userMarker.current.getElement();
      const shouldBeArrow = hasHeading;
      const isCurrentlyArrow = markerEl.classList.contains(styles.userMarkerArrow);

      if (shouldBeArrow && !isCurrentlyArrow) {
        markerEl.className = styles.userMarkerArrow;
      } else if (!shouldBeArrow && isCurrentlyArrow) {
        markerEl.className = styles.userMarker;
      }
    }

    // Apply compass rotation only if heading is available (arrow mode)
    const markerEl = userMarker.current.getElement();
    if (hasHeading) {
      // Rotate the arrow to point in the direction of the compass heading
      // DeviceOrientationEvent.alpha gives us compass heading where:
      // 0 = North, 90 = East, 180 = South, 270 = West
      markerEl.style.transform = `rotate(${userLocation.heading}deg)`;
    } else {
      // No rotation for square marker
      markerEl.style.transform = "";
    }
  }, [userLocation]);

  useEffect(() => {
    if (!onLocationChange) return;
    onLocationChange(userLocation ? userLocation.coordinates : null);
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

    // Apply filters to all layers
    if (map.current.getLayer("underground-lines-layer")) {
      map.current.setFilter("underground-lines-layer", lineFilter);
    }
    if (map.current.getLayer("underground-lines-stroke")) {
      map.current.setFilter("underground-lines-stroke", lineFilter);
    }
    if (map.current.getLayer("underground-stations-layer")) {
      map.current.setFilter("underground-stations-layer", stationFilter);
    }
    if (map.current.getLayer("underground-stations-glow")) {
      map.current.setFilter("underground-stations-glow", stationFilter);
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
async function loadUndergroundData(map: mapboxgl.Map, signal?: AbortSignal) {
  try {
    const [lines, stations] = await Promise.all([
      fetchUndergroundLines(signal),
      fetchUndergroundStations(signal),
    ]);

    const linesSource = map.getSource(
      "underground-lines",
    ) as mapboxgl.GeoJSONSource;
    const stationsSource = map.getSource(
      "underground-stations",
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
