import { NextResponse } from "next/server";
import type { ParsedQuery, AiSearchResult } from "~/lib/searchTypes";
import { SearchResponseSchema } from "~/lib/schemas";
import {
  callGeminiTool,
  normalizeGeminiPayload,
  SEARCH_RADIUS_KM,
} from "~/lib/gemini";
import {
  geocodeAddress,
  getDistanceKm,
  reverseGeocodeAddress,
} from "~/lib/geocoding";
import { RESULT_LIMIT } from "~/lib/constants";

/**
 * Build a fallback response when Gemini API is unavailable
 */
function buildFallback(
  query: string,
  userLocation?: { latitude: number; longitude: number },
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
  const userLocationAddress = userLocation
    ? await reverseGeocodeAddress(userLocation)
    : null;

  // Return fallback if Gemini API key is not configured
  if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    return NextResponse.json(buildFallback(query, userLocation));
  }

  try {
    // Call Gemini API for search intent and suggestions
    const geminiResponse = await callGeminiTool({
      query,
      userLocation,
      userLocationAddress: userLocationAddress || undefined,
    });

    // Extract and parse response
    const parts = geminiResponse?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((part) => part.text)?.text;

    let parsedArgs: unknown = null;
    if (typeof textPart === "string") {
      try {
        parsedArgs = JSON.parse(textPart);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.log("Gemini raw text:", JSON.stringify(textPart, null, 2));
        }
        throw error;
      }
    } else if (process.env.NODE_ENV !== "production") {
      console.log(
        "Gemini response missing text part:",
        JSON.stringify(parts, null, 2),
      );
    }

    if (!parsedArgs) {
      return NextResponse.json(buildFallback(query, userLocation));
    }

    // Log in development
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "Gemini raw response:",
        JSON.stringify(geminiResponse, null, 2),
      );
      console.log("Gemini parsed args:", JSON.stringify(parsedArgs, null, 2));
    }

    // Normalize the response to a consistent format
    const normalizedArgs = normalizeGeminiPayload(
      parsedArgs,
      query,
      userLocation,
    );

    // Validate with Zod schema
    const validation = SearchResponseSchema.safeParse(normalizedArgs);
    if (!validation.success) {
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "Gemini normalized args:",
          JSON.stringify(normalizedArgs, null, 2),
        );
      }
      console.warn("Search tool validation errors:", validation.error.message);

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

    normalized.results = normalized.results.slice(0, RESULT_LIMIT);
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "Search normalized results count:",
        normalized.results.length,
      );
    }

    // Geocode addresses to coordinates (in parallel)
    normalized.results = await Promise.all(
      normalized.results.map(async (result) => {
        if (!result.address || result.coordinates) {
          return result;
        }

        const coords = await geocodeAddress(result.address, userLocation);
        if (!coords) {
          if (process.env.NODE_ENV !== "production") {
            console.log("Geocode failed for address:", result.address);
          }
          return result;
        }

        return { ...result, coordinates: coords };
      }),
    );

    if (process.env.NODE_ENV !== "production") {
      const withCoords = normalized.results.filter(
        (result) => result.coordinates,
      ).length;
      console.log("Geocoded results count:", withCoords);
    }

    // Filter results by distance if user location is provided
    if (userLocation) {
      if (process.env.NODE_ENV !== "production") {
        const distances = normalized.results
          .filter((result) => result.coordinates)
          .map((result) => ({
            name: result.name,
            distanceKm: Number(
              getDistanceKm(userLocation, result.coordinates!).toFixed(2),
            ),
          }));
        console.log(
          "Distances before filter:",
          JSON.stringify(distances, null, 2),
        );
      }
      normalized.results = normalized.results.filter((result) => {
        if (!result.coordinates) return false;
        const distance = getDistanceKm(userLocation, result.coordinates);
        return distance <= SEARCH_RADIUS_KM;
      });
      if (process.env.NODE_ENV !== "production") {
        console.log(
          "Results after distance filter:",
          normalized.results.length,
        );
      }
    }

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Search tool error:", error);
    return NextResponse.json(buildFallback(query, userLocation));
  }
}
