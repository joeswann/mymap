# London Underground Map

Interactive full-screen map application displaying London with a toggleable London Underground layer.

## Features

- Full-screen interactive street map
- London Underground lines and stations overlay
- Individual line toggles in expandable sidebar
- **Business search** powered by Foursquare (restaurants, shops, etc.)
- Station and location search
- Price filtering ($ to $$$$)
- Rating display
- Responsive design

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Mapbox GL JS
- SCSS Modules
- Yarn workspaces monorepo

## Setup

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Get API keys:

   **Mapbox (required):**
   - Sign up at https://account.mapbox.com/
   - Create a new token or use your default public token

   **Foursquare (required for business search):**
   - Sign up at https://location.foursquare.com/developer/
   - Create a project in Developer Console
   - Copy your API key

   Copy `.env.example` to `.env` and add both tokens

3. Run the development server:
   ```bash
   yarn dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
map/
├── packages/
│   ├── frontend/          # Next.js 16 app
│   │   └── src/
│   │       ├── app/       # App router pages
│   │       ├── components/
│   │       │   └── map/   # Map components
│   │       ├── styles/    # Global styles
│   │       └── lib/       # Utilities
│   └── common/            # Shared utilities
└── package.json           # Root workspace config
```

## Development

- `yarn dev` - Start development server
- `yarn build` - Build for production
- `yarn start` - Start production server
- `yarn lint` - Run ESLint

## Data Sources

This application uses real London Underground network data from multiple sources:

- **Lines & Stations**: Oliver O'Brien's TfL GeoJSON dataset (CC-By-NC licensed)
  - GitHub Repository: [oobrien/vis](https://github.com/oobrien/vis)
  - Original data from OpenStreetMap (ODbL licensed)
- **Official Colors**: Transport for London brand guidelines

### Data Attribution

The TfL lines and stations data is:
- Licensed under CC-By-NC (Creative Commons Attribution-NonCommercial)
- Originally sourced from OpenStreetMap contributors
- Compiled and maintained by Oliver O'Brien ([oobrien.com](https://oobrien.com/))

Additional resources:
- [TfL Open Data Users](https://tfl.gov.uk/info-for/open-data-users/)
- [TfL API Portal](https://api-portal.tfl.gov.uk/)
- [London Datastore](https://data.london.gov.uk/)

The application caches TfL data for 24 hours to minimize external requests.
