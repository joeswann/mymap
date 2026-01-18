import { z } from "zod";

// Parsed Query Schema - Validates search query structure
export const ParsedQuerySchema = z.object({
  searchTerm: z.string(),
  location: z
    .object({
      area: z.string().optional(),
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

// AI Result Schema - Validates AI-generated place results
export const AiResultSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  address: z.string().optional(),
  photoUrl: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  sources: z.array(z.string()).optional(),
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

// Search Response Schema - Top-level response validation
export const SearchResponseSchema = z.object({
  parsedQuery: ParsedQuerySchema,
  results: z.array(AiResultSchema).optional(),
});
