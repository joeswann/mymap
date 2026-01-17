import { NextResponse } from "next/server";
import { UNDERGROUND_LINE_COLORS, isUndergroundLine } from "~/lib/underground";

// Real TfL data from Oliver O'Brien's repository (CC-By-NC licensed)
// Source: https://github.com/oobrien/vis/blob/master/tubecreature/data/tfl_lines.json
// Data originally from OpenStreetMap
const TFL_LINES_URL =
  "https://raw.githubusercontent.com/oobrien/vis/master/tubecreature/data/tfl_lines.json";

export async function GET() {
  try {
    const response = await fetch(TFL_LINES_URL, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error("Failed to fetch TfL lines data");
    }

    const data = await response.json();

    // Filter to only London Underground lines and add colors
    // Create separate features for each line (since tracks can be shared)
    const undergroundFeatures: any[] = [];

    data.features.forEach((feature: any) => {
      // Get all unique line names from the lines array
      const lineNames = feature.properties.lines
        .map((line: any) => line.name)
        .filter((name: string) => isUndergroundLine(name));

      // Create a separate feature for each Underground line
      lineNames.forEach((lineName: string) => {
        undergroundFeatures.push({
          type: "Feature",
          properties: {
            id: `${feature.properties.id}-${lineName}`,
            originalId: feature.properties.id,
            name: lineName,
            colour: UNDERGROUND_LINE_COLORS[lineName] || "#000000",
            lines: feature.properties.lines.filter((line: any) =>
              line.name === lineName
            ),
          },
          geometry: feature.geometry,
        });
      });
    });

    return NextResponse.json({
      type: "FeatureCollection",
      features: undergroundFeatures,
    });
  } catch (error) {
    console.error("Error fetching Underground lines:", error);
    return NextResponse.json(
      { error: "Failed to fetch Underground lines" },
      { status: 500 }
    );
  }
}
