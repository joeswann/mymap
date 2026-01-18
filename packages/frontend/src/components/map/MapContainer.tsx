"use client";

import { useState } from "react";
import mapboxgl from "mapbox-gl";
import MapView from "./MapView";
import MapSidebar from "./MapSidebar";
import MapSearch from "./MapSearch";
import styles from "./MapContainer.module.scss";

export default function MapContainer() {
  const [map, setMap] = useState<mapboxgl.Map | null>(null);

  // Initialize all lines as hidden (user must enable them)
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({});

  const toggleLine = (line: string) => {
    setVisibleLines((prev) => ({
      ...prev,
      [line]: !prev[line],
    }));
  };

  return (
    <div className={styles.container}>
      <MapView visibleLines={visibleLines} onMapLoad={setMap} />
      <MapSearch map={map} />
      <MapSidebar visibleLines={visibleLines} onToggleLine={toggleLine} />
    </div>
  );
}
