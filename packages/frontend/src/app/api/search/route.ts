import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { ParsedQuery, AiSearchResult } from "~/lib/searchTypes";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  results: z.array(AiResultSchema),
});

const SYSTEM_PROMPT = `
You are a map search assistant. Use the tool to return structured search intent and a short list of suggested places.

Guidelines:
- Extract the user's search intent and filters.
- If the user provides a location (area or coordinates), include it.
- Provide up to 5 suggested places relevant to the query.
- Only include coordinates when you are confident; otherwise omit them.
- Keep descriptions concise and useful (1 sentence).
`;

const TOOL_SCHEMA = {
  name: "map_search",
  description: "Return parsed search intent and suggested places.",
  parameters: {
    type: "object",
    additionalProperties: false,
    required: ["parsedQuery", "results"],
    properties: {
      parsedQuery: {
        type: "object",
        additionalProperties: false,
        required: ["searchTerm"],
        properties: {
          searchTerm: { type: "string" },
          location: {
            type: "object",
            additionalProperties: false,
            properties: {
              area: { type: "string" },
              coordinates: {
                type: "object",
                additionalProperties: false,
                properties: {
                  latitude: { type: "number" },
                  longitude: { type: "number" },
                },
              },
            },
          },
          context: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
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
                type: "object",
                additionalProperties: false,
                properties: {
                  cuisine: {
                    type: "array",
                    items: { type: "string" },
                  },
                  priceRange: {
                    type: "string",
                    enum: ["low", "medium", "high", "luxury"],
                  },
                  openNow: { type: "boolean" },
                  rating: { type: "number", minimum: 0, maximum: 5 },
                  amenities: {
                    type: "array",
                    items: { type: "string" },
                  },
                  distance: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      value: { type: "number" },
                      unit: { type: "string", enum: ["miles", "kilometers"] },
                    },
                  },
                },
              },
            },
          },
        },
      },
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            coordinates: {
              type: "object",
              additionalProperties: false,
              properties: {
                latitude: { type: "number" },
                longitude: { type: "number" },
              },
            },
            type: {
              type: "string",
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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(buildFallback(query, userLocation));
  }

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: query },
    ];

    if (userLocation) {
      messages.push({
        role: "user",
        content: `User location: ${userLocation.latitude}, ${userLocation.longitude}`,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      tools: [{ type: "function", function: TOOL_SCHEMA }],
      tool_choice: {
        type: "function",
        function: { name: "map_search" },
      },
      temperature: 0.4,
    });

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    const rawArgs = toolCall?.function?.arguments;
    if (!rawArgs) {
      return NextResponse.json(buildFallback(query, userLocation));
    }

    const parsedArgs = JSON.parse(rawArgs);
    const validation = SearchResponseSchema.safeParse(parsedArgs);
    if (!validation.success) {
      console.warn("Search tool validation errors:", validation.error.format());
      return NextResponse.json(buildFallback(query, userLocation));
    }

    const normalized = {
      ...validation.data,
      parsedQuery: {
        ...validation.data.parsedQuery,
        location: {
          ...validation.data.parsedQuery.location,
          ...(userLocation && { coordinates: userLocation }),
        },
      },
    };

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Search tool error:", error);
    return NextResponse.json(buildFallback(query, userLocation));
  }
}
