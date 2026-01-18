import type { ParsedQuery } from "./searchTypes";

/**
 * Format parsed query description for display in search results
 * Converts query context and filters into a human-readable string
 */
export function formatParsedQueryDescription(parsedQuery: ParsedQuery): string {
  const parts: string[] = [];
  const { location, context } = parsedQuery;

  if (context?.type) {
    parts.push(`Type: ${context.type}`);
  }

  if (location?.area) {
    parts.push(`Area: ${location.area}`);
  }

  if (context?.filters?.priceRange) {
    parts.push(`Price: ${context.filters.priceRange}`);
  }

  if (context?.filters?.openNow) {
    parts.push("Open now");
  }

  if (context?.filters?.rating) {
    parts.push(`Rating: ${context.filters.rating}+`);
  }

  if (context?.filters?.cuisine?.length) {
    parts.push(`Cuisine: ${context.filters.cuisine.join(", ")}`);
  }

  if (context?.filters?.amenities?.length) {
    parts.push(`Amenities: ${context.filters.amenities.join(", ")}`);
  }

  if (context?.filters?.distance) {
    parts.push(
      `Within ${context.filters.distance.value} ${context.filters.distance.unit}`
    );
  }

  return parts.length > 0 ? parts.join(" · ") : "No filters detected";
}

/**
 * Get emoji icon for different result types
 */
export function getResultIcon(type: string): string {
  switch (type) {
    case "station":
      return "🚇";
    case "place":
      return "🧭";
    case "intent":
      return "✨";
    default:
      return "📍";
  }
}
