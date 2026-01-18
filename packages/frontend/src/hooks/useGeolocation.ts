import { useState, useCallback, useEffect, RefObject } from "react";
import type mapboxgl from "mapbox-gl";
import { DEFAULT_CENTER, DEFAULT_ZOOM, GEOLOCATION_TIMEOUT_MS, GEOLOCATION_MAX_AGE_MS } from "~/lib/constants";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeolocationState {
  coordinates: Coordinates;
  heading: number | null; // Compass heading in degrees (0-360), null if unavailable
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
 * Also tracks compass heading if available
 */
export function useGeolocation(
  mapRef: RefObject<mapboxgl.Map | null>,
  options: UseGeolocationOptions = {}
) {
  const { shouldFlyTo = false } = options;
  const [location, setLocation] = useState<GeolocationState | null>(null);

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
          const coordinates: Coordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          // Get initial heading from geolocation if available
          const initialHeading = position.coords.heading !== null && !isNaN(position.coords.heading)
            ? position.coords.heading
            : null;

          setLocation({
            coordinates,
            heading: initialHeading,
          });

          if (flyTo && map) {
            map.flyTo({
              center: [coordinates.longitude, coordinates.latitude],
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

  // Track compass heading using DeviceOrientationEvent
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      // alpha: compass heading (0-360 degrees)
      // Note: alpha represents the device's rotation around the z-axis
      // 0 = North, 90 = East, 180 = South, 270 = West
      const heading = event.alpha;

      if (heading !== null && !isNaN(heading)) {
        setLocation((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            heading,
          };
        });
      }
    };

    // Request permission on iOS 13+ devices
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof (DeviceOrientationEvent as any).requestPermission === "function") {
      (DeviceOrientationEvent as any).requestPermission()
        .then((response: string) => {
          if (response === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
          }
        })
        .catch(console.error);
    } else {
      // Add listener directly for other devices
      window.addEventListener("deviceorientation", handleOrientation);
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, []);

  return {
    location,
    requestLocation,
  };
}
