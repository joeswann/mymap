import { NextResponse } from "next/server";
import { z } from "zod";
import type { ParsedQuery, AiSearchResult } from "~/lib/searchTypes";

const SEARCH_RADIUS_KM = 10;

const ParsedQuerySchema = z.object({
  searchTerm: z.string(),
  location: z
    .object({
      area: z.string().optional(),
      coordinates: z
        .object({
          latitude: z.number().optional(),
          longitude: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
  context: z
    .object({
      type: z
        .preprocess((value) => {
          if (typeof value !== "string") return value;
          const normalized = value.toLowerCase();
          const allowed = new Set([
            "restaurant",
            "hotel",
            "cafe",
            "park",
            "landmark",
            "store",
            "other",
          ]);
          return allowed.has(normalized) ? normalized : "other";
        }, z.enum(["restaurant", "hotel", "cafe", "park", "landmark", "store", "other"]))
        .optional(),
      filters: z
        .object({
          cuisine: z.string().array().optional(),
          priceRange: z.enum(["low", "medium", "high", "luxury"]).optional(),
          openNow: z.boolean().optional(),
          rating: z.number().min(0).max(5).optional(),
          amenities: z.string().array().optional(),
          distance: z
            .object({
              value: z.number(),
              unit: z.enum(["miles", "kilometers"]),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

const AiResultSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  address: z.string().optional(),
  coordinates: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  type: z
    .enum([
      "place",
      "restaurant",
      "hotel",
      "cafe",
      "park",
      "landmark",
      "store",
      "other",
    ])
    .optional(),
});

const SearchResponseSchema = z.object({
  parsedQuery: ParsedQuerySchema,
  results: z.array(AiResultSchema).optional(),
});

const SYSTEM_PROMPT = `
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

const TOOL_SCHEMA = {
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

const buildFallback = (
  query: string,
  userLocation?: { latitude: number; longitude: number }
): { parsedQuery: ParsedQuery; results: AiSearchResult[] } => ({
  parsedQuery: {
    searchTerm: query,
    ...(userLocation && { location: { coordinates: userLocation } }),
  },
  results: [],
});

function normalizeGeminiPayload(
  raw: any,
  query: string,
  userLocation?: { latitude: number; longitude: number }
): { parsedQuery: ParsedQuery; results: AiSearchResult[] } {
  if (!raw || typeof raw !== "object") {
    return buildFallback(query, userLocation);
  }

  if (raw.parsedQuery) {
    return raw;
  }

  const searchIntent =
    raw.search_intent && typeof raw.search_intent === "object"
      ? raw.search_intent
      : null;

  const parsedQuery: ParsedQuery = {
    searchTerm:
      searchIntent?.query ||
      raw.search_intent ||
      raw.searchTerm ||
      query,
    ...(searchIntent?.filters && { context: { filters: searchIntent.filters } }),
    ...(searchIntent?.location
      ? {
          location: {
            coordinates: {
              latitude: searchIntent.location.latitude,
              longitude: searchIntent.location.longitude,
            },
          },
        }
      : raw.location && {
          location: {
            coordinates: {
              latitude: raw.location.latitude,
              longitude: raw.location.longitude,
            },
          },
        }),
  };

  const sourcePlaces = Array.isArray(raw.suggested_places)
    ? raw.suggested_places
    : Array.isArray(raw.places)
      ? raw.places
      : [];

  const results = sourcePlaces.length
    ? sourcePlaces.map((place: any, index: number) => ({
        id: place.id || `place-${index}`,
        name: place.name,
        description: place.description,
        address: place.address,
        coordinates: place.coordinates
          ? {
              latitude:
                place.coordinates.latitude ??
                place.coordinates.lat ??
                place.coordinates.y,
              longitude:
                place.coordinates.longitude ??
                place.coordinates.lng ??
                place.coordinates.x,
            }
          : undefined,
        type: "place",
      }))
    : [];

  return { parsedQuery, results };
}

function getViewbox(userLocation: { latitude: number; longitude: number }) {
  const latDelta = 10 / 111;
  const lngDelta =
    10 / (111 * Math.cos((userLocation.latitude * Math.PI) / 180));

  return {
    left: userLocation.longitude - lngDelta,
    right: userLocation.longitude + lngDelta,
    top: userLocation.latitude + latDelta,
    bottom: userLocation.latitude - latDelta,
  };
}

async function geocodeAddress(
  address: string,
  userLocation?: { latitude: number; longitude: number }
): Promise<{ latitude: number; longitude: number } | null> {
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
    return null;
  }

  const data = (await response.json()) as Array<{
    lat: string;
    lon: string;
  }>;

  if (!data.length) {
    return null;
  }

  return { latitude: Number(data[0].lat), longitude: Number(data[0].lon) };
}

function getDistanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
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

async function callGeminiTool(payload: {
  query: string;
  userLocation?: { latitude: number; longitude: number };
}) {
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

  if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    return NextResponse.json(buildFallback(query, userLocation));
  }

  try {
    const geminiResponse = await callGeminiTool({
      query,
      userLocation,
    });

    const parts = geminiResponse?.candidates?.[0]?.content?.parts || [];
    const textPart = parts.find((part: any) => part.text)?.text;
    let parsedArgs: unknown = null;
    if (typeof textPart === "string") {
      parsedArgs = JSON.parse(textPart);
    }

    if (!parsedArgs) {
      return NextResponse.json(buildFallback(query, userLocation));
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("Gemini raw response:", geminiResponse);
      console.log("Gemini parsed args:", parsedArgs);
    }

    const normalizedArgs = normalizeGeminiPayload(
      parsedArgs,
      query,
      userLocation
    );

    const validation = SearchResponseSchema.safeParse(normalizedArgs);
    if (!validation.success) {
      console.warn("Search tool validation errors:", validation.error.format());
      return NextResponse.json(buildFallback(query, userLocation));
    }

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

    for (const result of normalized.results) {
      if (result.address) {
        result.coordinates = await geocodeAddress(result.address, userLocation);
      }
    }

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
