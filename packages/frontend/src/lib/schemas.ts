import { z } from "zod";

// URL validation helper - ensures valid HTTP(S) URLs (optional, allows empty strings)
const urlSchema = z
  .string()
  .optional()
  .refine(
    (url) => {
      if (!url || url === "") return true; // Allow empty/undefined
      try {
        const parsed = new URL(url);
        // Must be http/https
        if (!["http:", "https:"].includes(parsed.protocol)) return false;
        // Must have a domain
        if (!parsed.hostname || parsed.hostname === "localhost") return false;
        return true;
      } catch {
        return false;
      }
    },
    { message: "Must be a valid, accessible HTTP(S) URL" },
  );

// Source validation - ensures format "Name" or "Name | URL"
const sourceSchema = z.string().refine(
  (source) => {
    // Allow plain text sources (e.g., "google", "reddit")
    if (!source.includes("|")) return true;

    // If pipe exists, validate URL part
    const parts = source.split("|").map((s) => s.trim());
    if (parts.length !== 2) return false;

    try {
      const url = new URL(parts[1]);
      // Must be http/https
      if (!["http:", "https:"].includes(url.protocol)) return false;
      return true;
    } catch {
      return false;
    }
  },
  { message: "Source must be 'Name' or 'Name | URL' format with valid URL" },
);

// Parsed Query Schema - Validates search query structure
export const ParsedQuerySchema = z.object({
  searchTerm: z.string(),
  location: z
    .object({
      area: z.string().optional(),
    })
    .passthrough() // Allow additional properties like coordinates
    .optional(),
  context: z
    .object({
      type: z
        .preprocess(
          (value) => {
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
          },
          z.enum([
            "restaurant",
            "hotel",
            "cafe",
            "park",
            "landmark",
            "store",
            "other",
          ]),
        )
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
        .catchall(z.any())
        .optional(),
    })
    .optional(),
});

// AI Result Schema - Validates AI-generated place results with URL validation
export const AiResultSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    address: z.string().optional(),
    rating: z.number().min(0).max(5).optional(),
    priceRange: z.enum(["low", "medium", "high", "luxury"]).optional(),
    website: urlSchema,
    phone: z.string().optional(),
    sources: z.array(sourceSchema).optional(),
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
    // Confidence score based on data quality (sources, URLs, etc.)
    confidence: z.enum(["high", "medium", "low"]).optional(),
  })
  .passthrough(); // Allow additional properties like coordinates

// Search Response Schema - Top-level response validation with metadata
export const SearchResponseSchema = z.object({
  parsedQuery: ParsedQuerySchema,
  results: z.array(AiResultSchema).optional(),
  // Metadata about search result quality
  metadata: z
    .object({
      resultsWithSources: z.number().optional(),
      resultsWithWebsites: z.number().optional(),
      averageConfidence: z.number().optional(),
    })
    .optional(),
});
