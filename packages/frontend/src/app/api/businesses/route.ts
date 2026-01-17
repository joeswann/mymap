import { NextResponse } from "next/server";

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY || "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const lat = searchParams.get("lat") || "51.5074";
  const lng = searchParams.get("lng") || "-0.1278";
  const minPrice = searchParams.get("minPrice") || "1";
  const maxPrice = searchParams.get("maxPrice") || "4";
  const limit = searchParams.get("limit") || "50";

  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  if (!FOURSQUARE_API_KEY) {
    return NextResponse.json(
      { error: "Foursquare API key not configured" },
      { status: 500 }
    );
  }

  try {
    const url = new URL("https://api.foursquare.com/v3/places/search");
    url.searchParams.set("query", query);
    url.searchParams.set("ll", `${lat},${lng}`);
    url.searchParams.set("radius", "10000"); // 10km radius
    url.searchParams.set("min_price", minPrice);
    url.searchParams.set("max_price", maxPrice);
    url.searchParams.set("limit", limit);
    url.searchParams.set("fields", "fsq_id,name,geocodes,location,categories,rating,price,photos,hours,distance");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: FOURSQUARE_API_KEY,
        Accept: "application/json",
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`Foursquare API error: ${response.status}`);
    }

    const data = await response.json();

    // Transform to our format
    const businesses = data.results?.map((place: any) => ({
      id: place.fsq_id,
      name: place.name,
      coordinates: [
        place.geocodes?.main?.longitude,
        place.geocodes?.main?.latitude,
      ],
      address: formatAddress(place.location),
      categories: place.categories?.map((cat: any) => cat.name) || [],
      rating: place.rating || null,
      price: place.price || null,
      distance: place.distance,
      photos: place.photos?.map((photo: any) =>
        `${photo.prefix}300x300${photo.suffix}`
      ) || [],
    })) || [];

    return NextResponse.json({
      results: businesses,
      total: data.results?.length || 0,
    });
  } catch (error) {
    console.error("Foursquare API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch businesses" },
      { status: 500 }
    );
  }
}

function formatAddress(location: any): string {
  const parts = [
    location.address,
    location.locality || location.region,
    location.postcode,
  ].filter(Boolean);

  return parts.join(", ") || "Address not available";
}
