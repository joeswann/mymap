export type ParsedQuery = {
  searchTerm: string;
  location?: {
    area?: string;
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
    } & Record<string, unknown>;
  };
};

export type AiSearchResult = {
  id?: string;
  name: string;
  description?: string;
  address?: string;
  photoUrl?: string;
  rating?: number;
  priceRange?: "low" | "medium" | "high" | "luxury";
  website?: string;
  phone?: string;
  sources?: string[];
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
    address?: string;
    photoUrl?: string;
    rating?: number;
    priceRange?: "low" | "medium" | "high" | "luxury";
    website?: string;
    phone?: string;
    sources?: string[];
  }
  | {
      id: string;
      name: string;
      description: string;
      type: "intent";
    };
