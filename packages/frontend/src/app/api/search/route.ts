import { NextResponse } from "next/server";
import type { ParsedQuery, AiSearchResult } from "~/lib/searchTypes";
import { SearchResponseSchema } from "~/lib/schemas";
import {
  callGeminiTool,
  normalizeGeminiPayload,
  SEARCH_RADIUS_KM,
} from "~/lib/gemini";
import { geocodeAddress, getDistanceKm } from "~/lib/geocoding";

/**
 * Build a fallback response when Gemini API is unavailable
 */
function buildFallback(
  query: string,
  userLocation?: { latitude: number; longitude: number }
): { parsedQuery: ParsedQuery; results: AiSearchResult[] } {
  return {
    parsedQuery: {
      searchTerm: query,
      ...(userLocation && { location: { coordinates: userLocation } }),
    },
    results: [],
  };
}

/**
 * Search API endpoint
 * Uses Gemini AI to parse search intent and suggest places
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  const userLocation =
    lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : undefined;

  // Return fallback if Gemini API key is not configured
  if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    return NextResponse.json(buildFallback(query, userLocation));
  }

  try {
    // Call Gemini API for search intent and suggestions
    const geminiResponse = await callGeminiTool({
      query,
      userLocation,
    });

    // Extract and parse response
    const parts = geminiResponse?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((part) => part.text)?.text;

    let parsedArgs: unknown = null;
    if (typeof textPart === "string") {
      parsedArgs = JSON.parse(textPart);
    }

    if (!parsedArgs) {
      return NextResponse.json(buildFallback(query, userLocation));
    }

    // Log in development
    if (process.env.NODE_ENV !== "production") {
      console.log("Gemini raw response:", geminiResponse);
      console.log("Gemini parsed args:", parsedArgs);
    }

    // Normalize the response to a consistent format
    const normalizedArgs = normalizeGeminiPayload(
      parsedArgs,
      query,
      userLocation
    );

    // Validate with Zod schema
    const validation = SearchResponseSchema.safeParse(normalizedArgs);
    if (!validation.success) {
      console.warn("Search tool validation errors:", validation.error.format());
      return NextResponse.json(buildFallback(query, userLocation));
    }

    // Ensure user location is included in the response
    const normalized = {
      ...validation.data,
      results: validation.data.results ?? [],
      parsedQuery: {
        ...validation.data.parsedQuery,
        location: {
          ...validation.data.parsedQuery.location,
          ...(userLocation && { coordinates: userLocation }),
        },
      },
    };

    // Geocode addresses to coordinates
    for (const result of normalized.results) {
      if (result.address) {
        const coords = await geocodeAddress(result.address, userLocation);
        if (coords) {
          result.coordinates = coords;
        }
      }
    }

    // Filter results by distance if user location is provided
    if (userLocation) {
      normalized.results = normalized.results.filter((result) => {
        if (!result.coordinates) return false;
        const distance = getDistanceKm(userLocation, result.coordinates);
        return distance <= SEARCH_RADIUS_KM;
      });
    }

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Search tool error:", error);
    return NextResponse.json(buildFallback(query, userLocation));
  }
}
