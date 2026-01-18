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
  results?: Array<{
    id?: string;
    name: string;
    description?: string;
    address?: string;
    photoUrl?: string;
    rating?: number;
    website?: string;
    phone?: string;
    sources?: string[];
  }>;
}

// System prompt for Gemini
export const SYSTEM_PROMPT = `
You are a map search assistant. Use the tool to return structured search intent and a short list of real, well-known places.

Guidelines:
- Extract the user's search intent and filters.
- If the user provides a location (area or coordinates), include it.
- Only include real companies/places you are confident exist.
- Provide up to 10 suggested places relevant to the query.
- Use the viewport center as the reference and keep results within ~10km.
- Include a street address or full place address for every result.
- Include a short description, rating (0-5), website, phone, and a photo URL if available.
- If available, include a priceRange as one of: low, medium, high, luxury.
- Only include photoUrl values that are publicly accessible direct image URLs.
- If you cite an address, include sources (URLs or names like "reddit") when known.
- Favor broader coverage by checking sources like Reddit threads, forums, and community reviews when relevant.
- Do not include coordinates; the server will geocode addresses.
- Use the viewport center only for relevance; do not include it in output.
- Keep descriptions concise and useful (1 sentence).
- Respond with ONLY valid JSON that matches the tool schema exactly.
- Use camelCase keys only (e.g., "photoUrl", "parsedQuery", "searchTerm").
- For sources, use "Name | URL" format when possible (e.g., "Reddit | https://reddit.com/...").
- Prefer recent, stable sources and avoid outdated or dead links.
- Ensure any website/source links are valid, fully qualified URLs.
- Do not use keys like "searchIntent" or "suggestedPlaces"; use "parsedQuery" and "results".
- Output shape example:
  {"parsedQuery":{"searchTerm":"jeans","context":{"filters":{"category":"clothing store"}}},"results":[{"name":"Example Store","address":"1 High St, London","description":"Short description.","rating":4.2,"website":"https://example.com","phone":"+44 20 0000 0000","photoUrl":"https://example.com/photo.jpg","sources":["google"]}]}
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
            photoUrl: { type: "STRING" },
            rating: { type: "NUMBER" },
            priceRange: {
              type: "STRING",
              enum: ["low", "medium", "high", "luxury"],
            },
            website: { type: "STRING" },
            phone: { type: "STRING" },
            sources: { type: "ARRAY", items: { type: "STRING" } },
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
  userLocationAddress?: string;
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
    payload.userLocationAddress
      ? `User location address: ${payload.userLocationAddress}`
      : "",
    payload.userLocation
      ? `Viewport center: ${payload.userLocation.latitude}, ${payload.userLocation.longitude}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
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
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API error: ${response.status} ${response.statusText} - ${errorText}`,
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
  userLocation?: { latitude: number; longitude: number },
): { parsedQuery: ParsedQuery; results: AiSearchResult[] } {
  // Fallback for null/invalid responses
  if (!raw || typeof raw !== "object") {
    return {
      parsedQuery: {
        searchTerm: query,
        ...(userLocation && { location: { area: "Near you" } }),
      },
      results: [],
    };
  }

  // If already normalized, return as-is
  if (raw.parsedQuery) {
    const rawParsed = raw.parsedQuery as ParsedQuery & {
      filters?: NonNullable<ParsedQuery["context"]>["filters"];
    };
    const location = rawParsed.location;
    const context = rawParsed.context ? { ...rawParsed.context } : undefined;
    if (!context?.filters && rawParsed.filters) {
      if (context) {
        context.filters = rawParsed.filters;
      } else {
        (rawParsed as ParsedQuery).context = { filters: rawParsed.filters };
      }
    }

    return {
      parsedQuery: {
        searchTerm: rawParsed.searchTerm || query,
        ...(context && { context }),
        location: location?.area ? { area: location.area } : undefined,
      },
      results:
        (raw as { parsedQuery: ParsedQuery; results: AiSearchResult[] })
          .results || [],
    };
  }

  const parsedQuery: ParsedQuery = {
    searchTerm: query,
    ...(userLocation && { location: { area: "Near you" } }),
  };

  const sourcePlaces = Array.isArray(raw.results) ? raw.results : [];
  if (!Array.isArray(raw.results) && process.env.NODE_ENV !== "production") {
    console.log("Gemini response missing results array:", raw);
  }

  // Normalize place results
  const results: AiSearchResult[] = sourcePlaces.map((place, index) => ({
    id: place.id || `place-${index}`,
    name: place.name,
    description: place.description,
    address: place.address,
    photoUrl: place.photoUrl,
    rating: typeof place.rating === "number" ? place.rating : undefined,
    priceRange: place.priceRange,
    website: place.website,
    phone: place.phone,
    sources: Array.isArray(place.sources) ? place.sources : undefined,
    type: "place",
  }));

  return { parsedQuery, results };
}

export { SEARCH_RADIUS_KM };
