/**
 * Create filter expression for underground lines
 * Shows lines where the "name" property matches any visible line
 */
export function createLineFilter(visibleLineNames: string[]): any[] {
  if (visibleLineNames.length === 0) {
    // Hide all lines when none are visible
    return ["==", ["get", "name"], ""];
  }

  return ["in", ["get", "name"], ["literal", visibleLineNames]];
}

/**
 * Create filter expression for underground stations
 * Shows stations where at least one of their lines is visible
 */
export function createStationFilter(visibleLineNames: string[]): any[] {
  if (visibleLineNames.length === 0) {
    // Hide all stations when no lines are visible
    return ["==", ["get", "name"], ""];
  }

  return [
    "any",
    ...visibleLineNames.map((lineName) => [
      "in",
      lineName,
      ["get", "lines"],
    ]),
  ];
}
