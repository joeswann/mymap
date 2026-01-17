"use client";

import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import styles from "./MapSearch.module.scss";
import classNames from "classnames";

interface MapSearchProps {
  map: mapboxgl.Map | null;
}

interface SearchResult {
  id: string;
  name: string;
  description: string;
  coordinates: [number, number];
  type: "station" | "location" | "business";
  rating?: number;
  price?: number;
  categories?: string[];
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export default function MapSearch({ map }: MapSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Debounce search
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    setIsSearching(true);
    const searchResults: SearchResult[] = [];

    try {
      // Parallel searches
      const [stationsData, businessesData, geocodingData] = await Promise.all([
        // Search Underground stations
        fetch("/api/underground/stations").then((r) => r.json()),

        // Search businesses (Foursquare)
        map
          ? fetch(
              `/api/businesses?q=${encodeURIComponent(searchQuery)}&lat=${
                map.getCenter().lat
              }&lng=${map.getCenter().lng}&limit=10`
            ).then((r) => r.json())
          : Promise.resolve({ results: [] }),

        // Search locations (Mapbox)
        fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            searchQuery
          )}.json?access_token=${MAPBOX_TOKEN}&proximity=-0.1276,51.5074&limit=5&types=poi,place,locality,neighborhood,address`
        ).then((r) => r.json()),
      ]);

      // Add station results
      const matchingStations = stationsData.features
        ?.filter((feature: any) =>
          feature.properties.name
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        )
        .slice(0, 3)
        .map((feature: any) => ({
          id: `station-${feature.properties.id}`,
          name: feature.properties.displayName || feature.properties.name,
          description: `Underground Station · Zone ${feature.properties.zone || "N/A"}`,
          coordinates: feature.geometry.coordinates,
          type: "station" as const,
        })) || [];

      searchResults.push(...matchingStations);

      // Add business results
      const businessResults = businessesData.results
        ?.slice(0, 5)
        .map((business: any) => ({
          id: `business-${business.id}`,
          name: business.name,
          description: formatBusinessDescription(business),
          coordinates: business.coordinates,
          type: "business" as const,
          rating: business.rating,
          price: business.price,
          categories: business.categories,
        })) || [];

      searchResults.push(...businessResults);

      // Add location results
      const locationResults = geocodingData.features
        ?.slice(0, 3)
        .map((feature: any) => ({
          id: `location-${feature.id}`,
          name: feature.text,
          description: feature.place_name,
          coordinates: feature.center,
          type: "location" as const,
        })) || [];

      searchResults.push(...locationResults);

      setResults(searchResults.slice(0, 10));
      setShowResults(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const formatBusinessDescription = (business: any): string => {
    const parts: string[] = [];

    if (business.categories?.length > 0) {
      parts.push(business.categories[0]);
    }

    if (business.price) {
      parts.push("$".repeat(business.price));
    }

    if (business.rating) {
      parts.push(`★ ${business.rating.toFixed(1)}`);
    }

    if (business.distance) {
      const km = (business.distance / 1000).toFixed(1);
      parts.push(`${km}km`);
    }

    return parts.join(" · ") || business.address;
  };

  const handleSelectResult = (result: SearchResult) => {
    if (!map) return;

    const zoom = result.type === "station" ? 15 : result.type === "business" ? 16 : 14;

    map.flyTo({
      center: result.coordinates,
      zoom,
      duration: 1500,
    });

    setQuery("");
    setResults([]);
    setShowResults(false);
  };

  const getResultIcon = (type: string): string => {
    switch (type) {
      case "station":
        return "🚇";
      case "business":
        return "🏪";
      case "location":
        return "📍";
      default:
        return "📍";
    }
  };

  return (
    <div className={styles.search}>
      <div className={styles.form}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search businesses, stations & locations..."
          className={styles.input}
          onFocus={() => query.length >= 2 && setShowResults(true)}
        />
        {isSearching && <div className={styles.spinner}>⏳</div>}
      </div>

      {showResults && results.length > 0 && (
        <>
          <div className={styles.results}>
            {results.map((result) => (
              <button
                key={result.id}
                className={styles.result}
                onClick={() => handleSelectResult(result)}
              >
                <span
                  className={classNames(styles.icon, {
                    [styles.station]: result.type === "station",
                    [styles.business]: result.type === "business",
                  })}
                >
                  {getResultIcon(result.type)}
                </span>
                <div className={styles.resultContent}>
                  <div className={styles.resultName}>{result.name}</div>
                  <div className={styles.resultDescription}>
                    {result.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div
            className={styles.resultsOverlay}
            onClick={() => setShowResults(false)}
          />
        </>
      )}
    </div>
  );
}
