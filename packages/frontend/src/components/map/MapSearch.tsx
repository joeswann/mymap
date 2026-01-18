"use client";

import { useState, useEffect, useRef } from "react";
import type mapboxgl from "mapbox-gl";
import styles from "./MapSearch.module.scss";
import classNames from "classnames";
import type { SearchResult } from "~/lib/searchTypes";
import { fetchUndergroundStations, fetchSearch } from "~/lib/api";
import { formatParsedQueryDescription, getResultIcon } from "~/lib/searchHelpers";
import { createMarkers, clearMarkers } from "~/lib/mapbox/markers";
import { RESULT_LIMIT } from "~/lib/constants";
import type { TflStationFeature } from "~/lib/tflTypes";

interface MapSearchProps {
  map: mapboxgl.Map | null;
}

export default function MapSearch({ map }: MapSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [intentResult, setIntentResult] = useState<SearchResult | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const markersRef = useRef<any[]>([]); // Use any[] for mapbox markers
  const emptyStateQueryRef = useRef<string | null>(null);
  const latestSearchId = useRef(0);
  const cacheRef = useRef(
    new Map<string, { results: SearchResult[]; intent: SearchResult | null }>()
  );

  // Marker management effect
  useEffect(() => {
    if (!map) return;

    // Clear existing markers
    clearMarkers(markersRef.current);
    markersRef.current = [];

    // Create new markers for search results
    markersRef.current = createMarkers(map, results, (result) => {
      if (result.type === "place") {
        setSelectedResult(result);
      }
    });

    return () => {
      clearMarkers(markersRef.current);
      markersRef.current = [];
    };
  }, [map, results]);

  /**
   * Perform search using both AI and station search
   */
  const performSearch = async (
    searchQuery: string,
    cacheKey: string,
    searchId: number
  ) => {
    try {
      const userLocation = map
        ? { latitude: map.getCenter().lat, longitude: map.getCenter().lng }
        : undefined;

      // Fetch both stations and AI search in parallel
      const [stationsData, aiData] = await Promise.all([
        fetchUndergroundStations(),
        fetchSearch(searchQuery, userLocation),
      ]);

      const intent: SearchResult = {
        id: "intent",
        name: `Search: ${aiData.parsedQuery.searchTerm || searchQuery}`,
        description: formatParsedQueryDescription(aiData.parsedQuery),
        type: "intent",
      };

      const effectiveQuery = (aiData.parsedQuery.searchTerm || searchQuery).trim();
      if (!effectiveQuery) {
        if (searchId !== latestSearchId.current) {
          return;
        }
        setIntentResult(intent);
        setResults([]);
        emptyStateQueryRef.current = cacheKey;
        setShowResults(true);
        return;
      }

      // Add AI-suggested places
      const aiResults: SearchResult[] = aiData.results.map((result, index) => ({
        id: result.id || `place-${index}`,
        name: result.name,
        description: result.description || result.address || "Suggested place",
        address: result.address,
        photoUrl: result.photoUrl,
        rating: result.rating,
        website: result.website,
        phone: result.phone,
        sources: result.sources,
        coordinates: result.coordinates
          ? [result.coordinates.longitude, result.coordinates.latitude]
          : undefined,
        type: "place" as const,
      }));

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

      // Limit total results
      const nextResults = [...aiResults, ...matchingStations].slice(
        0,
        RESULT_LIMIT
      );

      if (searchId !== latestSearchId.current) {
        return;
      }

      setIntentResult(intent);
      setResults(nextResults);
      setSelectedResult(null);
      setShowResults(true);

      if (nextResults.length > 0) {
        cacheRef.current.set(cacheKey, {
          results: nextResults,
          intent,
        });
        emptyStateQueryRef.current = null;
      } else {
        emptyStateQueryRef.current = cacheKey;
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      if (searchId === latestSearchId.current) {
        setIsSearching(false);
      }
    }
  };

  /**
   * Handle result selection - fly map to location
   */
  const handleSelectResult = (result: SearchResult) => {
    if (!map) return;
    if (!result.coordinates) return;

    const zoom = 15;

    map.flyTo({
      center: result.coordinates,
      zoom,
      duration: 1500,
    });

    if (result.type === "place") {
      setSelectedResult(result);
    } else {
      setSelectedResult(null);
    }
    setShowResults(true);
  };

  return (
    <div className={styles.search}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          const trimmedQuery = query.trim();
          const cacheKey = trimmedQuery.toLowerCase();

          if (!trimmedQuery) {
            setShowResults(false);
            setSelectedResult(null);
            return;
          }

          const cached = cacheRef.current.get(cacheKey);
          if (cached) {
            setResults(cached.results);
            setIntentResult(cached.intent);
            setShowResults(true);
            setSelectedResult(null);
          }

          emptyStateQueryRef.current = null;
          setIsSearching(true);
          setShowResults(true);
          setSelectedResult(null);

          const searchId = ++latestSearchId.current;
          performSearch(trimmedQuery, cacheKey, searchId);
        }}
      >
        <input
          id="map-search"
          name="map-search"
          type="text"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            const nextQuery = e.target.value;
            const cacheKey = nextQuery.trim().toLowerCase();
            setQuery(nextQuery);
            setSelectedResult(null);

            if (!cacheKey) {
              setShowResults(false);
              emptyStateQueryRef.current = null;
              return;
            }

            const cached = cacheRef.current.get(cacheKey);
            if (cached) {
              setResults(cached.results);
              setIntentResult(cached.intent);
              setShowResults(true);
              emptyStateQueryRef.current = null;
              return;
            }

            if (emptyStateQueryRef.current !== cacheKey) {
              emptyStateQueryRef.current = null;
            }
          }}
          placeholder="Search the map in plain English..."
          className={styles.input}
          onFocus={() => {
            if (results.length > 0 || intentResult || isSearching) {
              setShowResults(true);
            }
          }}
          aria-label="Search the map"
        />
        {isSearching && <div className={styles.spinner}>⏳</div>}
      </form>

      {showResults && (
        <>
          <div className={styles.results}>
            {intentResult && (
              <div className={classNames(styles.result, styles.resultStatic)}>
                <span className={classNames(styles.icon, styles.intent)}>
                  {getResultIcon("intent")}
                </span>
                <div className={styles.resultContent}>
                  <div className={styles.resultName}>{intentResult.name}</div>
                  <div className={styles.resultDescription}>
                    {intentResult.description}
                  </div>
                </div>
              </div>
            )}
            {results.map((result) => (
              <button
                key={result.id}
                className={styles.result}
                onClick={() => handleSelectResult(result)}
                type="button"
              >
                <span
                  className={classNames(styles.icon, {
                    [styles.station]: result.type === "station",
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
            {!isSearching &&
              results.length === 0 &&
              emptyStateQueryRef.current === query.trim().toLowerCase() && (
                <div className={classNames(styles.result, styles.resultStatic)}>
                  <div className={styles.resultContent}>
                    <div className={styles.resultName}>No results</div>
                    <div className={styles.resultDescription}>
                      Try a different search or press Enter to retry.
                    </div>
                  </div>
                </div>
              )}
          </div>
          <div
            className={styles.resultsOverlay}
            onClick={() => setShowResults(false)}
          />
        </>
      )}

      {selectedResult?.type === "place" && (
        <div className={styles.infoCard}>
          {selectedResult.photoUrl && (
            <div className={styles.infoPhotoWrap}>
              <img
                src={selectedResult.photoUrl}
                alt={selectedResult.name}
                className={styles.infoPhoto}
              />
            </div>
          )}
          <div className={styles.infoBody}>
            <div className={styles.infoTitle}>{selectedResult.name}</div>
            {selectedResult.address && (
              <div className={styles.infoMeta}>{selectedResult.address}</div>
            )}
            {typeof selectedResult.rating === "number" && (
              <div className={styles.infoMeta}>
                Rating: {selectedResult.rating.toFixed(1)} / 5
              </div>
            )}
            {selectedResult.description && (
              <div className={styles.infoDescription}>
                {selectedResult.description}
              </div>
            )}
            <div className={styles.infoLinks}>
              {selectedResult.website && (
                <a
                  href={selectedResult.website}
                  target="_blank"
                  rel="noreferrer"
                >
                  Website
                </a>
              )}
              {selectedResult.phone && (
                <a href={`tel:${selectedResult.phone}`}>Call</a>
              )}
            </div>
            {selectedResult.sources && selectedResult.sources.length > 0 && (
              <div className={styles.infoSources}>
                <span>Sources:</span>
                <div className={styles.infoSourceList}>
                  {selectedResult.sources.map((source, index) => {
                    const trimmed = source.trim();
                    const isUrl = /^https?:\/\//i.test(trimmed);
                    return isUrl ? (
                      <a
                        key={`${trimmed}-${index}`}
                        href={trimmed}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {new URL(trimmed).hostname}
                      </a>
                    ) : (
                      <span key={`${trimmed}-${index}`}>{trimmed}</span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
