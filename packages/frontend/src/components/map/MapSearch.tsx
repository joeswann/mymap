"use client";

import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import styles from "./MapSearch.module.scss";
import classNames from "classnames";
import type { ParsedQuery } from "~/lib/searchTypes";

interface MapSearchProps {
  map: mapboxgl.Map | null;
}

type SearchResult =
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
      const userLocation = map
        ? { latitude: map.getCenter().lat, longitude: map.getCenter().lng }
        : undefined;

      const [stationsData, aiResponse] = await Promise.all([
        fetch("/api/underground/stations").then((r) => r.json()),
        fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}${
            userLocation
              ? `&lat=${userLocation.latitude}&lng=${userLocation.longitude}`
              : ""
          }`
        ),
      ]);

      const aiData = aiResponse.ok
        ? await aiResponse.json()
        : { parsedQuery: { searchTerm: searchQuery }, results: [] };

      const parsedQuery = aiData.parsedQuery as ParsedQuery;
      searchResults.push({
        id: "intent",
        name: `Search: ${parsedQuery.searchTerm || searchQuery}`,
        description: formatParsedQueryDescription(parsedQuery),
        type: "intent",
      });

      const effectiveQuery = (parsedQuery.searchTerm || searchQuery).trim();
      if (!effectiveQuery) {
        setResults(searchResults);
        setShowResults(true);
        return;
      }

      const aiResults =
        aiData.results?.map((result: any, index: number) => ({
          id: result.id || `place-${index}`,
          name: result.name,
          description: result.description || "Suggested place",
          coordinates: result.coordinates
            ? [result.coordinates.longitude, result.coordinates.latitude]
            : undefined,
          type: "place" as const,
        })) || [];

      searchResults.push(...aiResults);

      // Add station results
      const matchingStations = stationsData.features
        ?.filter((feature: any) =>
          feature.properties.name
            .toLowerCase()
            .includes(effectiveQuery.toLowerCase())
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

      const nextResults = searchResults.slice(0, 8);
      console.log("Map search results:", nextResults);
      setResults(nextResults);
      setShowResults(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const formatParsedQueryDescription = (parsedQuery: ParsedQuery): string => {
    const parts: string[] = [];
    const { location, context } = parsedQuery;

    if (context?.type) {
      parts.push(`Type: ${context.type}`);
    }

    if (location?.area) {
      parts.push(`Area: ${location.area}`);
    } else if (location?.coordinates) {
      parts.push("Near your location");
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
  };

  const handleSelectResult = (result: SearchResult) => {
    if (!map) return;
    if (result.type === "intent") {
      setShowResults(false);
      return;
    }
    if (!result.coordinates) {
      setShowResults(false);
      return;
    }

    const zoom = 15;

    map.flyTo({
      center: result.coordinates,
      zoom,
      duration: 1500,
    });

    setShowResults(true);
  };

  const getResultIcon = (type: string): string => {
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
  };

  return (
    <div className={styles.search}>
      <div className={styles.form}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the map in plain English..."
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
                    [styles.intent]: result.type === "intent",
                    [styles.place]: result.type === "place",
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
