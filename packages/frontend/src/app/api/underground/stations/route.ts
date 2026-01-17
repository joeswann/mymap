import { NextResponse } from "next/server";
import { isUndergroundLine } from "~/lib/underground";

// Real TfL data from Oliver O'Brien's repository (CC-By-NC licensed)
// Source: https://github.com/oobrien/vis/blob/master/tubecreature/data/tfl_stations.json
// Data originally from OpenStreetMap
const TFL_STATIONS_URL =
  "https://raw.githubusercontent.com/oobrien/vis/master/tubecreature/data/tfl_stations.json";

export async function GET() {
  try {
    const response = await fetch(TFL_STATIONS_URL, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) {
      throw new Error("Failed to fetch TfL stations data");
    }

    const data = await response.json();

    // Filter to only London Underground stations
    const undergroundFeatures = data.features
      .map((feature: any) => {
        // Get Underground lines that serve this station
        const undergroundLines = feature.properties.lines
          .map((line: any) => line.name)
          .filter((name: string) => isUndergroundLine(name));

        // Only include stations served by at least one Underground line
        if (undergroundLines.length === 0) return null;

        return {
          type: "Feature",
          properties: {
            id: feature.properties.id,
            name: feature.properties.name,
            displayName:
              feature.properties.cartography?.display ||
              feature.properties.name,
            zone: feature.properties.zone,
            lines: undergroundLines,
          },
          geometry: feature.geometry,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      type: "FeatureCollection",
      features: undergroundFeatures,
    });
  } catch (error) {
    console.error("Error fetching Underground stations:", error);
    return NextResponse.json(
      { error: "Failed to fetch Underground stations" },
      { status: 500 }
    );
  }
}
