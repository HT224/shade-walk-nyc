# Shade Walk NYC

Find a more shaded walking route through New York City.

**Live app:** https://shade-walk-nyc.vercel.app

Shade Walk offers two route objectives: **Shade** compares pedestrian routes against the sun, NYC buildings, and street trees; **Covered** uses active NYC DOB sidewalk-shed filings to test and rank routes that pass under more scaffolding. Both respect the user's maximum acceptable detour.

## What it does

- Searches NYC addresses with NYC Planning GeoSearch.
- Requests NYC-wide pedestrian routes from Valhalla/OpenStreetMap.
- Samples each route block by block.
- Estimates building shade using NYC Building Footprints / 3D Building Model roof heights and solar direction.
- Adds a street-tree shade signal from the NYC 2015 Street Tree Census.
- Ranks routes by shade while enforcing a 5–25% detour limit.
- Finds active sidewalk-shed filings in the walking corridor and generates additional pedestrian routes through useful shed locations.
- Ranks a separate rain-oriented Covered mode by estimated overhead coverage.
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
- DOB NOW: Build – Job Application Filings (`w9ak-ipjd`), filtered to permitted, unsigned-off sidewalk-shed work
- OpenStreetMap tiles and pedestrian graph
- Valhalla public routing service

Public community services have fair-use limits. A production app with meaningful traffic should host its own Valhalla instance and map tiles or use a commercial provider.
