// Geographic utility types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
}

interface NominatimReverseResult {
  display_name?: string;
}

/**
 * Geocode an address to coordinates using OpenStreetMap's Nominatim API
 */
export async function geocodeAddress(
  address: string,
  userLocation?: Coordinates
): Promise<Coordinates | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", address);

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "map-search/1.0 (local-dev)",
    },
  });

  if (!response.ok) {
    if (process.env.NODE_ENV !== "production") {
      const bodyText = await response.text().catch(() => "");
      console.log(
        "Geocode error response:",
        JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            body: bodyText,
            address,
          },
          null,
          2
        )
      );
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
 * Reverse geocode coordinates to a displayable address.
 */
export async function reverseGeocodeAddress(
  location: Coordinates
): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", location.latitude.toString());
  url.searchParams.set("lon", location.longitude.toString());
  url.searchParams.set("zoom", "16");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "map-search/1.0 (local-dev)",
    },
  });

  if (!response.ok) {
    if (process.env.NODE_ENV !== "production") {
      const bodyText = await response.text().catch(() => "");
      console.log(
        "Reverse geocode error response:",
        JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            body: bodyText,
          },
          null,
          2
        )
      );
    }
    return null;
  }

  const data = (await response.json()) as NominatimReverseResult;
  return data.display_name || null;
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
