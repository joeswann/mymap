// Official London Underground line colors
export const UNDERGROUND_LINE_COLORS: Record<string, string> = {
  Bakerloo: "#B36305",
  Central: "#E32017",
  Circle: "#FFD300",
  District: "#00782A",
  "Elizabeth line": "#9364CD",
  "Hammersmith & City": "#F3A9BB",
  Jubilee: "#A0A5A9",
  Metropolitan: "#9B0056",
  Northern: "#000000",
  Piccadilly: "#003688",
  Victoria: "#0098D4",
  "Waterloo & City": "#95CDBA",
};

export const UNDERGROUND_LINES = [
  "Bakerloo",
  "Central",
  "Circle",
  "District",
  "Elizabeth line",
  "Hammersmith & City",
  "Jubilee",
  "Metropolitan",
  "Northern",
  "Piccadilly",
  "Victoria",
  "Waterloo & City",
];

export function isUndergroundLine(lineName: string): boolean {
  return UNDERGROUND_LINES.includes(lineName);
}
