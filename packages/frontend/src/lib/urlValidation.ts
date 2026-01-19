import type { AiSearchResult } from "./searchTypes";

/**
 * Verify a URL is reachable and returns a successful response
 * Uses HEAD request for efficiency
 */
export async function verifyUrl(
  url: string,
  timeoutMs = 3000,
): Promise<{ valid: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      // Don't send cookies or credentials
      credentials: "omit",
    });

    clearTimeout(timeoutId);

    // Consider 2xx and 3xx as valid (successful or redirect)
    const valid = response.status >= 200 && response.status < 400;

    return {
      valid,
      status: response.status,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Batch verify URLs with parallel requests and rate limiting
 */
export async function verifyUrls(
  urls: string[],
  {
    concurrency = 5,
    timeoutMs = 3000,
  }: { concurrency?: number; timeoutMs?: number } = {},
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Remove duplicates
  const uniqueUrls = Array.from(new Set(urls));

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < uniqueUrls.length; i += concurrency) {
    const batch = uniqueUrls.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const result = await verifyUrl(url, timeoutMs);
        return [url, result.valid] as const;
      }),
    );

    batchResults.forEach(([url, valid]) => results.set(url, valid));
  }

  return results;
}

/**
 * Extract all URLs from a search result (website, sources)
 */
export function extractResultUrls(result: AiSearchResult): string[] {
  const urls: string[] = [];

  if (result.website) urls.push(result.website);

  // Extract URLs from sources (format: "Name | URL")
  result.sources?.forEach((source) => {
    if (source.includes("|")) {
      const parts = source.split("|").map((s) => s.trim());
      if (parts.length === 2) {
        try {
          new URL(parts[1]);
          urls.push(parts[1]);
        } catch {
          // Invalid URL, skip
        }
      }
    }
  });

  return urls;
}

/**
 * Calculate confidence score based on data quality
 * High: Has multiple verified sources and complete data
 * Medium: Has some sources or partial data
 * Low: Minimal data or no sources
 */
export function calculateConfidence(
  result: AiSearchResult,
): "high" | "medium" | "low" {
  let score = 0;

  // Has website (+2)
  if (result.website) score += 2;

  // Has sources with URLs (+3)
  const sourcesWithUrls =
    result.sources?.filter((s) => s.includes("|")).length || 0;
  if (sourcesWithUrls > 0) score += 3;

  // Has multiple sources (+1)
  if ((result.sources?.length || 0) > 1) score += 1;

  // Has rating (+1)
  if (result.rating !== undefined) score += 1;

  // Has address (+1)
  if (result.address) score += 1;

  // Has description (+1)
  if (result.description) score += 1;

  // Scoring thresholds
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

/**
 * Validate and clean a search result by verifying URLs
 * Removes invalid URLs and calculates confidence score
 */
export async function validateAndCleanResult(
  result: AiSearchResult,
  urlValidation: Map<string, boolean>,
): Promise<AiSearchResult> {
  const cleaned = { ...result };

  // Remove invalid website URL
  if (result.website && !urlValidation.get(result.website)) {
    cleaned.website = undefined;
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Invalid website URL for ${result.name}: ${result.website}`);
    }
  }

  // Filter sources to only valid ones
  if (result.sources) {
    cleaned.sources = result.sources.filter((source) => {
      // Plain text source (no URL), keep it
      if (!source.includes("|")) return true;

      // Extract and validate URL
      const parts = source.split("|").map((s) => s.trim());
      if (parts.length !== 2) return false;

      const url = parts[1];
      const isValid = urlValidation.get(url);

      if (!isValid && process.env.NODE_ENV !== "production") {
        console.warn(`Invalid source URL for ${result.name}: ${url}`);
      }

      return isValid;
    });

    // Remove sources array if empty
    if (cleaned.sources.length === 0) {
      cleaned.sources = undefined;
    }
  }

  // Calculate confidence score based on cleaned data
  cleaned.confidence = calculateConfidence(cleaned);

  return cleaned;
}
