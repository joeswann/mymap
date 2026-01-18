import type { Feature, FeatureCollection, LineString, Point } from "geojson";

// TfL Line Properties
export interface TflLineProperties {
  id: string;
  originalId: string;
  name: string;
  colour: string;
  lines: Array<{ name: string }>;
}

// TfL Station Properties
export interface TflStationProperties {
  id: string;
  name: string;
  displayName: string;
  zone: string | null;
  lines: string[];
}

// GeoJSON Feature types for TfL data
export type TflLineFeature = Feature<LineString, TflLineProperties>;
export type TflStationFeature = Feature<Point, TflStationProperties>;

// GeoJSON FeatureCollection types for TfL data
export type TflLineCollection = FeatureCollection<LineString, TflLineProperties>;
export type TflStationCollection = FeatureCollection<Point, TflStationProperties>;
