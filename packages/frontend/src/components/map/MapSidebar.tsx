"use client";

import { useState } from "react";
import { UNDERGROUND_LINES, UNDERGROUND_LINE_COLORS } from "~/lib/underground";
import styles from "./MapSidebar.module.scss";
import classNames from "classnames";

interface MapSidebarProps {
  visibleLines: Record<string, boolean>;
  onToggleLine: (line: string) => void;
}

export default function MapSidebar({
  visibleLines,
  onToggleLine,
}: MapSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [undergroundExpanded, setUndergroundExpanded] = useState(true);

  const allLinesVisible = UNDERGROUND_LINES.every(
    (line) => visibleLines[line]
  );
  const someLinesVisible = UNDERGROUND_LINES.some(
    (line) => visibleLines[line]
  );

  const toggleAllLines = () => {
    const newState = !allLinesVisible;
    UNDERGROUND_LINES.forEach((line) => {
      if (visibleLines[line] !== newState) {
        onToggleLine(line);
      }
    });
  };

  return (
    <>
      <button
        className={classNames(styles.toggle, { [styles.open]: isOpen })}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
      >
        <span className={styles.hamburger}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      <div className={classNames(styles.sidebar, { [styles.open]: isOpen })}>
        <div className={styles.header}>
          <h2 className={styles.title}>Map Layers</h2>
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <button
              className={styles.sectionHeader}
              onClick={() => setUndergroundExpanded(!undergroundExpanded)}
            >
              <span className={styles.sectionIcon}>🚇</span>
              <span className={styles.sectionTitle}>London Underground</span>
              <span
                className={classNames(styles.chevron, {
                  [styles.expanded]: undergroundExpanded,
                })}
              >
                ▼
              </span>
            </button>

            {undergroundExpanded && (
              <div className={styles.sectionContent}>
                <button
                  className={styles.toggleAll}
                  onClick={toggleAllLines}
                >
                  <span
                    className={classNames(styles.checkbox, {
                      [styles.checked]: allLinesVisible,
                      [styles.indeterminate]:
                        someLinesVisible && !allLinesVisible,
                    })}
                  >
                    {allLinesVisible ? "✓" : someLinesVisible ? "−" : ""}
                  </span>
                  <span>
                    {allLinesVisible ? "Hide all lines" : "Show all lines"}
                  </span>
                </button>

                <div className={styles.lineList}>
                  {UNDERGROUND_LINES.map((line) => (
                    <button
                      key={line}
                      className={styles.lineToggle}
                      onClick={() => onToggleLine(line)}
                    >
                      <span
                        className={classNames(styles.checkbox, {
                          [styles.checked]: visibleLines[line],
                        })}
                      >
                        {visibleLines[line] ? "✓" : ""}
                      </span>
                      <span
                        className={styles.lineIndicator}
                        style={{
                          backgroundColor: UNDERGROUND_LINE_COLORS[line],
                        }}
                      />
                      <span className={styles.lineName}>{line}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className={styles.overlay}
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
