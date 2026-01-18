// Geographic utility types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Viewbox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
}

/**
 * Calculate a geographic bounding box around a location for search purposes
 * Default radius: 10km
 */
export function getViewbox(userLocation: Coordinates): Viewbox {
  const latDelta = 10 / 111; // ~10km in latitude degrees
  const lngDelta =
    10 / (111 * Math.cos((userLocation.latitude * Math.PI) / 180)); // ~10km in longitude degrees

  return {
    left: userLocation.longitude - lngDelta,
    right: userLocation.longitude + lngDelta,
    top: userLocation.latitude + latDelta,
    bottom: userLocation.latitude - latDelta,
  };
}

/**
 * Geocode an address to coordinates using OpenStreetMap's Nominatim API
 * Optionally restricts search to a viewbox around a user location
 */
export async function geocodeAddress(
  address: string,
  userLocation?: Coordinates
): Promise<Coordinates | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", address);

  if (userLocation) {
    const viewbox = getViewbox(userLocation);
    url.searchParams.set(
      "viewbox",
      `${viewbox.left},${viewbox.top},${viewbox.right},${viewbox.bottom}`
    );
    url.searchParams.set("bounded", "1");
  }

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "map-search/1.0 (local-dev)",
    },
  });

  if (!response.ok) {
    if (process.env.NODE_ENV !== "production") {
      const bodyText = await response.text().catch(() => "");
      console.log("Geocode error response:", {
        status: response.status,
        statusText: response.statusText,
        body: bodyText,
        address,
      });
    }
    return null;
  }

  const data = (await response.json()) as NominatimResult[];

  if (!data.length) {
    return null;
  }

  return { latitude: Number(data[0].lat), longitude: Number(data[0].lon) };
}

/**
 * Calculate distance between two coordinates using the Haversine formula
 * Returns distance in kilometers
 */
export function getDistanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusKm * c;
}
