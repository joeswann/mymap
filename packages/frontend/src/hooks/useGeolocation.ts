import { useState, useCallback, RefObject } from "react";
import type mapboxgl from "mapbox-gl";
import { DEFAULT_CENTER, DEFAULT_ZOOM, GEOLOCATION_TIMEOUT_MS, GEOLOCATION_MAX_AGE_MS } from "~/lib/constants";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface UseGeolocationOptions {
  /** Whether to automatically request location on mount */
  autoRequest?: boolean;
  /** Whether to fly the map to the location when obtained */
  shouldFlyTo?: boolean;
}

/**
 * Custom hook for managing geolocation
 * Handles requesting user location and optionally centering the map
 */
export function useGeolocation(
  mapRef: RefObject<mapboxgl.Map | null>,
  options: UseGeolocationOptions = {}
) {
  const { shouldFlyTo = false } = options;
  const [location, setLocation] = useState<Coordinates | null>(null);

  const requestLocation = useCallback(
    (flyTo: boolean = shouldFlyTo) => {
      const map = mapRef.current;
      if (!navigator.geolocation) {
        // Geolocation not supported - fly to default if requested
        if (flyTo && map) {
          map.flyTo({
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            duration: 1200,
          });
        }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(nextLocation);

          if (flyTo && map) {
            map.flyTo({
              center: [nextLocation.longitude, nextLocation.latitude],
              zoom: DEFAULT_ZOOM,
              duration: 1200,
            });
          }
        },
        (error) => {
          console.warn("Geolocation error:", error);
          // Fall back to default location if requested
          if (flyTo && map) {
            map.flyTo({
              center: DEFAULT_CENTER,
              zoom: DEFAULT_ZOOM,
              duration: 1200,
            });
          }
        },
        {
          enableHighAccuracy: true,
          timeout: GEOLOCATION_TIMEOUT_MS,
          maximumAge: GEOLOCATION_MAX_AGE_MS,
        }
      );
    },
    [mapRef, shouldFlyTo]
  );

  return {
    location,
    requestLocation,
  };
}
