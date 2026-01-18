# mymap

Vibe-coded London Underground map with AI-assisted search and place markers.

## Overview

This is a Next.js + Mapbox GL app that visualizes London Underground lines
and stations, lets you toggle layers, and search for places with Gemini
powering intent parsing and suggestions.

## Features

- Mapbox GL map with user location and animated fly-to
- Toggle Underground lines and stations
- Search with Gemini (intent + suggested places) plus station matches
- Marker highlights and result details

## Tech Stack

- Next.js 16, React 19, TypeScript
- Mapbox GL + Sass modules
- Gemini API + OpenStreetMap Nominatim geocoding

## Getting Started

### Prerequisites

- Node.js 22.x
- Yarn 1.22.x

### Install

```sh
yarn install
```

### Configure

Create a `.env` file (you can copy `.env.example`) and set:

- `NEXT_PUBLIC_MAPBOX_TOKEN` (required) - Mapbox access token
- `NEXT_PUBLIC_GEMINI_API_KEY` (optional) - enables AI search results

### Run

```sh
yarn dev
```

### Build

```sh
yarn build
yarn start
```

## Project Structure

```
packages/
  common/        # Shared utilities
  frontend/      # Next.js app
```

## Data Sources

- TfL Underground lines and stations via OSM (see `ATTRIBUTION.md`)
- Geocoding via OpenStreetMap Nominatim

## Contributing

- Keep changes small and focused
- Run `yarn lint` before opening a PR

## License

See `ATTRIBUTION.md` for data licensing details.
