import type { ParsedQuery, AiSearchResult } from "./searchTypes";
import { SEARCH_RADIUS_KM } from "./constants";

// Gemini API response types
export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

// Gemini raw payload (before normalization)
interface GeminiRawPayload {
  parsedQuery?: ParsedQuery;
  search_intent?: {
    query?: string;
    filters?: NonNullable<ParsedQuery["context"]>["filters"];
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  searchTerm?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  suggested_places?: Array<{
    id?: string;
    name: string;
    description?: string;
    address?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
      lat?: number;
      lng?: number;
      x?: number;
      y?: number;
    };
  }>;
  places?: Array<{
    id?: string;
    name: string;
    description?: string;
    address?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
      lat?: number;
      lng?: number;
      x?: number;
      y?: number;
    };
  }>;
}

// System prompt for Gemini
export const SYSTEM_PROMPT = `
You are a map search assistant. Use the tool to return structured search intent and a short list of real, well-known places.

Guidelines:
- Extract the user's search intent and filters.
- If the user provides a location (area or coordinates), include it.
- Only include real companies/places you are confident exist.
- Provide up to 20 suggested places relevant to the query.
- Use the viewport center as the reference and keep results within ~10km.
- Include a street address or full place address for every result.
- Do not include coordinates; the server will geocode addresses.
- Keep descriptions concise and useful (1 sentence).
`;

// Gemini tool schema
export const TOOL_SCHEMA = {
  name: "map_search",
  description: "Return parsed search intent and suggested places.",
  parameters: {
    type: "OBJECT",
    required: ["parsedQuery", "results"],
    properties: {
      parsedQuery: {
        type: "OBJECT",
        required: ["searchTerm"],
        properties: {
          searchTerm: { type: "STRING" },
          location: {
            type: "OBJECT",
            properties: {
              area: { type: "STRING" },
              coordinates: {
                type: "OBJECT",
                properties: {
                  latitude: { type: "NUMBER" },
                  longitude: { type: "NUMBER" },
                },
              },
            },
          },
          context: {
            type: "OBJECT",
            properties: {
              type: {
                type: "STRING",
                enum: [
                  "restaurant",
                  "hotel",
                  "cafe",
                  "park",
                  "landmark",
                  "store",
                  "other",
                ],
              },
              filters: {
                type: "OBJECT",
                properties: {
                  cuisine: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                  },
                  priceRange: {
                    type: "STRING",
                    enum: ["low", "medium", "high", "luxury"],
                  },
                  openNow: { type: "BOOLEAN" },
                  rating: { type: "NUMBER", minimum: 0, maximum: 5 },
                  amenities: {
                    type: "ARRAY",
                    items: { type: "STRING" },
                  },
                  distance: {
                    type: "OBJECT",
                    properties: {
                      value: { type: "NUMBER" },
                      unit: { type: "STRING", enum: ["miles", "kilometers"] },
                    },
                  },
                },
              },
            },
          },
        },
      },
      results: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          required: ["name"],
          properties: {
            id: { type: "STRING" },
            name: { type: "STRING" },
            description: { type: "STRING" },
            address: { type: "STRING" },
            coordinates: {
              type: "OBJECT",
              properties: {
                latitude: { type: "NUMBER" },
                longitude: { type: "NUMBER" },
              },
            },
            type: {
              type: "STRING",
              enum: [
                "place",
                "restaurant",
                "hotel",
                "cafe",
                "park",
                "landmark",
                "store",
                "other",
              ],
            },
          },
        },
      },
    },
  },
};

/**
 * Call Gemini API to get structured search results
 */
export async function callGeminiTool(payload: {
  query: string;
  userLocation?: { latitude: number; longitude: number };
}): Promise<GeminiResponse | null> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = [
    "SYSTEM:",
    SYSTEM_PROMPT.trim(),
    "",
    "USER QUERY:",
    payload.query,
    payload.userLocation
      ? `Viewport center: ${payload.userLocation.latitude}, ${payload.userLocation.longitude}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.4,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

/**
 * Normalize Gemini API response to a consistent format
 * Handles different payload structures that Gemini might return
 */
export function normalizeGeminiPayload(
  raw: GeminiRawPayload | null | undefined,
  query: string,
  userLocation?: { latitude: number; longitude: number }
): { parsedQuery: ParsedQuery; results: AiSearchResult[] } {
  // Fallback for null/invalid responses
  if (!raw || typeof raw !== "object") {
    return {
      parsedQuery: {
        searchTerm: query,
        ...(userLocation && { location: { coordinates: userLocation } }),
      },
      results: [],
    };
  }

  // If already normalized, return as-is
  if (raw.parsedQuery) {
    return {
      parsedQuery: raw.parsedQuery,
      results: (raw as { parsedQuery: ParsedQuery; results: AiSearchResult[] }).results || [],
    };
  }

  // Extract search intent
  const searchIntent =
    raw.search_intent && typeof raw.search_intent === "object"
      ? raw.search_intent
      : null;

  // Build parsed query
  const parsedQuery: ParsedQuery = {
    searchTerm:
      searchIntent?.query ||
      (typeof raw.search_intent === "string" ? raw.search_intent : "") ||
      raw.searchTerm ||
      query,
  };

  // Add context with filters if available
  if (searchIntent?.filters) {
    parsedQuery.context = { filters: searchIntent.filters };
  }

  // Add location if available
  if (searchIntent?.location) {
    parsedQuery.location = {
      coordinates: {
        latitude: searchIntent.location.latitude,
        longitude: searchIntent.location.longitude,
      },
    };
  } else if (raw.location) {
    parsedQuery.location = {
      coordinates: {
        latitude: raw.location.latitude,
        longitude: raw.location.longitude,
      },
    };
  }

  // Extract places from various possible keys
  const sourcePlaces = Array.isArray(raw.suggested_places)
    ? raw.suggested_places
    : Array.isArray(raw.places)
      ? raw.places
      : [];

  // Normalize place results
  const results: AiSearchResult[] = sourcePlaces.map((place, index) => ({
    id: place.id || `place-${index}`,
    name: place.name,
    description: place.description,
    address: place.address,
    coordinates: place.coordinates
      ? {
          latitude:
            place.coordinates.latitude ??
            place.coordinates.lat ??
            place.coordinates.y ??
            0,
          longitude:
            place.coordinates.longitude ??
            place.coordinates.lng ??
            place.coordinates.x ??
            0,
        }
      : undefined,
    type: "place",
  }));

  return { parsedQuery, results };
}

export { SEARCH_RADIUS_KM };
