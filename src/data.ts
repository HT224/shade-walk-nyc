import type { BuildingPoint, LonLat, Place, TreePoint } from './types'
import { bbox } from './geo'

const NYC_BOUNDS = { west: -74.27, south: 40.49, east: -73.68, north: 40.93 }

export function inNyc([lon, lat]: LonLat): boolean {
  return lon >= NYC_BOUNDS.west && lon <= NYC_BOUNDS.east && lat >= NYC_BOUNDS.south && lat <= NYC_BOUNDS.north
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  if (query.trim().length < 3) return []
  const url = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(query)}&size=6`
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Address search is temporarily unavailable.')
  const json = await response.json() as { features?: Array<{ geometry: { coordinates: LonLat }, properties: { label?: string; name?: string; borough?: string } }> }
  return (json.features ?? [])
    .map((feature) => ({
      label: feature.properties.label ?? [feature.properties.name, feature.properties.borough].filter(Boolean).join(', '),
      coordinates: feature.geometry.coordinates,
    }))
    .filter((place) => inNyc(place.coordinates))
}

function parsePoint(value?: { coordinates?: LonLat } | string): LonLat | null {
  if (!value) return null
  if (typeof value === 'object' && value.coordinates) return value.coordinates
  if (typeof value === 'string') {
    const match = value.match(/POINT \(([-\d.]+) ([-\d.]+)\)/)
    if (match) return [Number(match[1]), Number(match[2])]
  }
  return null
}

export async function fetchTrees(route: LonLat[]): Promise<TreePoint[]> {
  const [west, south, east, north] = bbox(route, 0.0007)
  const where = `longitude between ${west} and ${east} AND latitude between ${south} and ${north}`
  const url = `https://data.cityofnewyork.us/resource/uvpi-gqnh.json?$select=longitude,latitude,health&$where=${encodeURIComponent(where)}&$limit=5000`
  try {
    const response = await fetch(url)
    if (!response.ok) return []
    const rows = await response.json() as Array<{ longitude: string; latitude: string; health?: string }>
    return rows.map((row) => ({ lon: Number(row.longitude), lat: Number(row.latitude), health: row.health }))
      .filter((tree) => Number.isFinite(tree.lon) && Number.isFinite(tree.lat))
  } catch { return [] }
}

export async function fetchBuildings(route: LonLat[]): Promise<BuildingPoint[]> {
  const [west, south, east, north] = bbox(route, 0.001)
  const polygon = `POLYGON((${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south}))`
  const where = `within_polygon(the_geom, '${polygon}')`
  const url = `https://data.cityofnewyork.us/resource/5zhs-2jue.json?$select=the_geom,height_roof&$where=${encodeURIComponent(where)}&$limit=5000`
  try {
    const response = await fetch(url)
    if (!response.ok) return []
    const rows = await response.json() as Array<{ the_geom?: { coordinates?: unknown }; height_roof?: string }>
    return rows.flatMap((row) => {
      const geometry = row.the_geom as { coordinates?: unknown } | undefined
      const rings = geometry?.coordinates as number[][][][] | number[][][] | undefined
      const ring = Array.isArray(rings?.[0]?.[0]?.[0]) ? (rings as number[][][][])[0][0] : (rings as number[][][])?.[0]
      if (!Array.isArray(ring) || !ring.length) return []
      const valid = ring.filter((p) => Array.isArray(p) && p.length >= 2)
      if (!valid.length) return []
      const point: LonLat = [valid.reduce((s, p) => s + p[0], 0) / valid.length, valid.reduce((s, p) => s + p[1], 0) / valid.length]
      const parsed = parsePoint({ coordinates: point })
      return parsed ? [{ lon: parsed[0], lat: parsed[1], heightM: Math.max(3, Number(row.height_roof) * 0.3048 || 10) }] : []
    })
  } catch { return [] }
}
