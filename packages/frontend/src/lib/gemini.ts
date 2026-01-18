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
    priceRange?: "low" | "medium" | "high" | "luxury";
    website?: string;
    phone?: string;
    sources?: string[];
  }>;
}

// System prompt for Gemini
export const SYSTEM_PROMPT = `
You are a map search assistant that finds hidden gems and popular spots recommended by real people on Reddit, forums, and review sites.

Guidelines:
- Extract the user's search intent and filters.
- If the user provides a location (area or coordinates), include it.
- **PRIORITIZE places with strong community recommendations** from Reddit, local forums, and review sites.
- Only include real companies/places you are confident exist and can cite from actual sources.
- Provide up to 10 suggested places, ranked by:
  1. Strength of community recommendations (Reddit upvotes, forum mentions)
  2. Recency of mentions (prefer recommendations from last 1-2 years)
  3. Geographic relevance to user location
- Use the viewport center as the reference and keep results within ~10km.
- Include a street address or full place address for every result.
- Include a short description that mentions why it's recommended (e.g., "Reddit favorite for authentic ramen").
- Include rating (0-5), website, phone, and a photo URL if available.
- If available, include a priceRange as one of: low, medium, high, luxury.

**SOURCE REQUIREMENTS (CRITICAL)**:
- For each result, cite specific sources where it was recommended
- Reddit sources MUST include subreddit name (e.g., "r/london", "r/AskUK")
- Prefer specific Reddit thread URLs over generic mentions
- For websites, use the actual article/page URL, not just the domain homepage
- Sources format: "Source Name | URL" (e.g., "Reddit r/london | https://reddit.com/r/london/comments/abc123/best_thai")
- If a place has multiple mentions, include the 2-3 most credible sources
- **DO NOT fabricate URLs** - if you don't have a real source URL, use just the source name (e.g., "reddit", "google")

**URL VALIDATION RULES**:
- All website URLs must be fully qualified (start with http:// or https://)
- All source URLs must point to actual pages/threads, not homepages
- Only include photoUrl values that are publicly accessible direct image URLs (no auth required)
- Prefer direct links to Reddit threads/comments over r/subreddit links
- Ensure any website/source links are valid, working URLs that you are confident exist

**OUTPUT FORMAT**:
- Do not include coordinates; the server will geocode addresses.
- Use the viewport center only for relevance; do not include it in output.
- Keep descriptions concise and useful (1 sentence).
- Respond with ONLY valid JSON that matches the tool schema exactly.
- Use camelCase keys only (e.g., "photoUrl", "parsedQuery", "searchTerm").
- Do not use keys like "searchIntent" or "suggestedPlaces"; use "parsedQuery" and "results".

**Example output**:
{
  "parsedQuery": {
    "searchTerm": "Thai restaurants",
    "location": {"area": "Waterloo"},
    "context": {"type": "restaurant", "filters": {"cuisine": ["Thai"]}}
  },
  "results": [
    {
      "name": "Sticky Rice",
      "address": "123 High St, London SE1 7XX",
      "description": "Highly rated on r/london for authentic Thai cuisine and reasonable prices",
      "rating": 4.5,
      "priceRange": "medium",
      "website": "https://stickyrice.co.uk",
      "phone": "+44 20 1234 5678",
      "photoUrl": "https://stickyrice.co.uk/photos/interior.jpg",
      "sources": [
        "Reddit r/london | https://reddit.com/r/london/comments/xyz123/best_thai_restaurants",
        "TimeOut London | https://timeout.com/london/restaurants/sticky-rice"
      ]
    }
  ]
}
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
