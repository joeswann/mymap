"use client";

import { useState, useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";
import styles from "./MapSearch.module.scss";
import classNames from "classnames";
import type { SearchResult } from "~/lib/searchTypes";
import { fetchUndergroundStations, fetchSearch } from "~/lib/api";
import { formatParsedQueryDescription, getResultIcon } from "~/lib/searchHelpers";
import { createMarkers, clearMarkers } from "~/lib/mapbox/markers";
import { SEARCH_DEBOUNCE_MS, RESULT_LIMIT } from "~/lib/constants";
import type { TflStationFeature } from "~/lib/tflTypes";

interface MapSearchProps {
  map: mapboxgl.Map | null;
}

export default function MapSearch({ map }: MapSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const markersRef = useRef<any[]>([]); // Use any[] for mapbox markers

  // Debounced search effect
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      performSearch(query);
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [query]);

  // Marker management effect
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    clearMarkers(markersRef.current);
    markersRef.current = [];

    // Create new markers for search results
    markersRef.current = createMarkers(map, results);

    return () => {
      clearMarkers(markersRef.current);
      markersRef.current = [];
    };
  }, [map, results]);

  /**
   * Perform search using both AI and station search
   */
  const performSearch = async (searchQuery: string) => {
    setIsSearching(true);
    const searchResults: SearchResult[] = [];

    try {
      const userLocation = map
        ? { latitude: map.getCenter().lat, longitude: map.getCenter().lng }
        : undefined;

      // Fetch both stations and AI search in parallel
      const [stationsData, aiData] = await Promise.all([
        fetchUndergroundStations(),
        fetchSearch(searchQuery, userLocation),
      ]);

      // Add search intent result
      searchResults.push({
        id: "intent",
        name: `Search: ${aiData.parsedQuery.searchTerm || searchQuery}`,
        description: formatParsedQueryDescription(aiData.parsedQuery),
        type: "intent",
      });

      const effectiveQuery = (aiData.parsedQuery.searchTerm || searchQuery).trim();
      if (!effectiveQuery) {
        setResults(searchResults);
        setShowResults(true);
        return;
      }

      // Add AI-suggested places
      const aiResults: SearchResult[] = aiData.results.map((result, index) => ({
        id: result.id || `place-${index}`,
        name: result.name,
        description: result.description || result.address || "Suggested place",
        coordinates: result.coordinates
          ? [result.coordinates.longitude, result.coordinates.latitude]
          : undefined,
        type: "place" as const,
      }));

      searchResults.push(...aiResults);

      // Add matching stations
      const matchingStations: SearchResult[] = stationsData.features
        .filter((feature: TflStationFeature) =>
          feature.properties.name
            .toLowerCase()
            .includes(effectiveQuery.toLowerCase())
        )
        .slice(0, 3)
        .map((feature: TflStationFeature) => ({
          id: `station-${feature.properties.id}`,
          name: feature.properties.displayName || feature.properties.name,
          description: `Underground Station · Zone ${feature.properties.zone || "N/A"}`,
          coordinates: feature.geometry.coordinates as [number, number],
          type: "station" as const,
        }));

      searchResults.push(...matchingStations);

      // Limit total results
      const nextResults = searchResults.slice(0, RESULT_LIMIT);
      setResults(nextResults);
      setShowResults(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Handle result selection - fly map to location
   */
  const handleSelectResult = (result: SearchResult) => {
    if (!map) return;

    if (result.type === "intent" || !result.coordinates) {
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

  return (
    <div className={styles.search}>
      <div className={styles.form}>
        <input
          id="map-search"
          name="map-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the map in plain English..."
          className={styles.input}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          aria-label="Search the map"
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
