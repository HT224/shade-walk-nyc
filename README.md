# Shade Walk NYC

Find a more shaded walking route through New York City.

**Live app:** https://shade-walk-nyc.vercel.app

Shade Walk compares valid pedestrian routes against the sun's position, NYC building data, and the 2015 Street Tree Census. It favors the route with the strongest estimated shade while respecting the user's maximum acceptable detour.

## What it does

- Searches NYC addresses with NYC Planning GeoSearch.
- Requests NYC-wide pedestrian routes from Valhalla/OpenStreetMap.
- Samples each route block by block.
- Estimates building shade using NYC Building Footprints / 3D Building Model roof heights and solar direction.
- Adds a street-tree shade signal from the NYC 2015 Street Tree Census.
- Ranks routes by shade while enforcing a 5–25% detour limit.
- Draws exact route geometry and provides turn-by-turn directions.
- Works as a mobile-first installable PWA.

## Accuracy

Shade is an estimate. Open datasets do not perfectly capture tree canopy size, scaffolding, awnings, new construction, or exact sidewalk-side conditions. The app explains its inputs and avoids claiming a mathematically perfect or guaranteed shaded route.

## Development

```bash
npm install
npm run dev
npm run check
```

No API keys are required.

## Data and services

- NYC Planning GeoSearch
- NYC Building Footprints / 3D Building Model (`5zhs-2jue`)
- NYC 2015 Street Tree Census (`uvpi-gqnh`)
- OpenStreetMap tiles and pedestrian graph
- Valhalla public routing service

Public community services have fair-use limits. A production app with meaningful traffic should host its own Valhalla instance and map tiles or use a commercial provider.
