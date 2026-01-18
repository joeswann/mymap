export type ParsedQuery = {
  searchTerm: string;
  location?: {
    area?: string;
    coordinates?: {
      latitude?: number;
      longitude?: number;
    };
  };
  context?: {
    type?: "restaurant" | "hotel" | "cafe" | "park" | "landmark" | "store" | "other";
    filters?: {
      cuisine?: string[];
      priceRange?: "low" | "medium" | "high" | "luxury";
      openNow?: boolean;
      rating?: number;
      amenities?: string[];
      distance?: {
        value: number;
        unit: "miles" | "kilometers";
      };
    };
  };
};

export type AiSearchResult = {
  id?: string;
  name: string;
  description?: string;
  address?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  type?:
    | "place"
    | "restaurant"
    | "hotel"
    | "cafe"
    | "park"
    | "landmark"
    | "store"
    | "other";
};

// Search Result types (used in MapSearch component)
export type SearchResult =
  | {
      id: string;
      name: string;
      description: string;
      coordinates: [number, number];
      type: "station";
    }
  | {
      id: string;
      name: string;
      description: string;
      coordinates?: [number, number];
      type: "place";
    }
  | {
      id: string;
      name: string;
      description: string;
      type: "intent";
    };
