import { angularDifference, bearing, distanceM, sampleLine } from './geo'
import { fetchBuildings, fetchSidewalkSheds, fetchTrees } from './data'
import { sunPosition } from './sun'
import type { BuildingPoint, LonLat, RouteCandidate, RouteStep, SidewalkShed, TreePoint } from './types'

const VALHALLA = 'https://valhalla1.openstreetmap.de/route'

interface ValhallaManeuver {
  instruction?: string
  length?: number
  begin_shape_index?: number
}

interface ValhallaLeg {
  shape: string
  maneuvers?: ValhallaManeuver[]
  summary: { length: number; time: number }
}

interface ValhallaTrip {
  legs: ValhallaLeg[]
  summary: { length: number; time: number }
}

interface ValhallaResponse {
  trip: ValhallaTrip
  alternates?: Array<{ trip: ValhallaTrip } | ValhallaTrip>
}

export function decodePolyline(encoded: string, precision = 6): LonLat[] {
  const coordinates: LonLat[] = []
  let index = 0
  let lat = 0
  let lon = 0
  const factor = 10 ** precision
  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    result = 0
    shift = 0
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    lon += result & 1 ? ~(result >> 1) : result >> 1
    coordinates.push([lon / factor, lat / factor])
  }
  return coordinates
}

function tripToCandidate(trip: ValhallaTrip, index: number): RouteCandidate {
  const geometry = trip.legs.flatMap((leg, legIndex) => {
    const decoded = decodePolyline(leg.shape)
    return legIndex ? decoded.slice(1) : decoded
  })
  let shapeOffset = 0
  const steps: RouteStep[] = trip.legs.flatMap((leg) => {
    const legGeometry = decodePolyline(leg.shape)
    const output = (leg.maneuvers ?? []).map((maneuver) => ({
      instruction: maneuver.instruction ?? 'Continue',
      distanceM: (maneuver.length ?? 0) * 1000,
      coordinates: geometry[Math.min(geometry.length - 1, shapeOffset + (maneuver.begin_shape_index ?? 0))],
    }))
    shapeOffset += Math.max(0, legGeometry.length - 1)
    return output
  })
  return {
    id: `route-${index + 1}`,
    geometry,
    distanceM: trip.summary.length * 1000,
    durationSec: trip.summary.time,
    shadePercent: 0,
    buildingShade: 0,
    treeShade: 0,
    coveredPercent: 0,
    shedCount: 0,
    score: 0,
    steps,
  }
}

async function requestWalkingRoutes(locations: LonLat[], alternates = 0): Promise<RouteCandidate[]> {
  const payload = {
    locations: locations.map(([lon, lat], index) => ({ lon, lat, type: index === 0 || index === locations.length - 1 ? 'break' : 'through' })),
    costing: 'pedestrian',
    units: 'kilometers',
    alternates,
    directions_options: { units: 'kilometers' },
  }
  const response = await fetch(`${VALHALLA}?json=${encodeURIComponent(JSON.stringify(payload))}`)
  if (!response.ok) throw new Error('Walking directions are temporarily unavailable.')
  const data = await response.json() as ValhallaResponse
  const trips: ValhallaTrip[] = [data.trip, ...(data.alternates ?? []).map((alternate) => 'trip' in alternate ? alternate.trip : alternate)]
  return trips.map(tripToCandidate).filter((route) => route.geometry.length > 1)
}

export async function fetchWalkingRoutes(origin: LonLat, destination: LonLat): Promise<RouteCandidate[]> {
  return requestWalkingRoutes([origin, destination], 3)
}

function shadeAt(point: LonLat, next: LonLat, trees: TreePoint[], buildings: BuildingPoint[], at: Date): { tree: number; building: number } {
  const sun = sunPosition(at, point)
  if (sun.altitude <= 0) return { tree: 1, building: 1 }
  const nearbyTrees = trees.filter((tree) => distanceM(point, [tree.lon, tree.lat]) < 14 && tree.health !== 'Dead').length
  const tree = Math.min(0.72, nearbyTrees * 0.24)
  let building = 0
  for (const candidate of buildings) {
    const buildingPoint: LonLat = [candidate.lon, candidate.lat]
    const distance = distanceM(point, buildingPoint)
    if (distance > 120) continue
    const towardSun = angularDifference(bearing(point, buildingPoint), sun.azimuth)
    const shadowReach = candidate.heightM / Math.tan(Math.max(0.08, sun.altitude * Math.PI / 180))
    if (towardSun < 24 && distance <= shadowReach) building = Math.max(building, 0.88 * (1 - distance / Math.max(shadowReach, 1)))
  }
  const streetOrientation = angularDifference(bearing(point, next), sun.azimuth)
  if (streetOrientation > 65 && streetOrientation < 115) building = Math.min(0.95, building + 0.08)
  return { tree, building }
}

async function enrichRoute(route: RouteCandidate, at: Date, shortestM: number, maxDetour: number, trees: TreePoint[], buildings: BuildingPoint[]): Promise<RouteCandidate> {
  const samples = sampleLine(route.geometry)
  let treeTotal = 0
  let buildingTotal = 0
  let combinedTotal = 0
  samples.forEach((sample, index) => {
    const shade = shadeAt(sample, samples[Math.min(samples.length - 1, index + 1)], trees, buildings, at)
    treeTotal += shade.tree
    buildingTotal += shade.building
    combinedTotal += 1 - (1 - shade.tree) * (1 - shade.building)
  })
  const count = Math.max(1, samples.length)
  const shadePercent = Math.round(combinedTotal / count * 100)
  const detour = route.distanceM / shortestM - 1
  const allowed = detour <= maxDetour + 0.01
  return {
    ...route,
    shadePercent,
    treeShade: Math.round(treeTotal / count * 100),
    buildingShade: Math.round(buildingTotal / count * 100),
    score: allowed ? shadePercent - detour * 55 : -1000 - detour * 100,
  }
}

export async function rankRoutes(routes: RouteCandidate[], at: Date, maxDetour = 0.15): Promise<RouteCandidate[]> {
  if (!routes.length) return []
  const shortestM = Math.min(...routes.map((route) => route.distanceM))
  const allGeometry = routes.flatMap((route) => route.geometry)
  const [trees, buildings] = await Promise.all([fetchTrees(allGeometry), fetchBuildings(allGeometry)])
  const enriched = await Promise.all(routes.map((route) => enrichRoute(route, at, shortestM, maxDetour, trees, buildings)))
  return enriched.sort((a, b) => b.score - a.score)
}

function distanceToLineM(point: LonLat, start: LonLat, end: LonLat): number {
  const latScale = 111320
  const lonScale = Math.cos((start[1] + end[1]) / 2 * Math.PI / 180) * 111320
  const px = (point[0] - start[0]) * lonScale
  const py = (point[1] - start[1]) * latScale
  const ex = (end[0] - start[0]) * lonScale
  const ey = (end[1] - start[1]) * latScale
  const t = Math.max(0, Math.min(1, (px * ex + py * ey) / Math.max(1, ex * ex + ey * ey)))
  return Math.hypot(px - t * ex, py - t * ey)
}

function coveredScore(route: RouteCandidate, sheds: SidewalkShed[], shortestM: number, maxDetour: number): RouteCandidate {
  const samples = sampleLine(route.geometry, 18)
  const nearby = new Set<string>()
  let covered = 0
  for (const sample of samples) {
    const matching = sheds.filter((shed) => distanceM(sample, [shed.lon, shed.lat]) <= 32)
    if (matching.length) {
      covered += 1
      matching.forEach((shed) => nearby.add(shed.filing))
    }
  }
  const coveredPercent = Math.round(covered / Math.max(1, samples.length) * 100)
  const detour = route.distanceM / shortestM - 1
  return {
    ...route,
    coveredPercent,
    shedCount: nearby.size,
    score: detour <= maxDetour + 0.01 ? coveredPercent - detour * 35 : -1000 - detour * 100,
  }
}

export async function fetchAndRankCoveredRoutes(origin: LonLat, destination: LonLat, maxDetour = 0.15): Promise<RouteCandidate[]> {
  const baseline = await fetchWalkingRoutes(origin, destination)
  if (!baseline.length) return []
  const shortestM = Math.min(...baseline.map((route) => route.distanceM))
  const sheds = await fetchSidewalkSheds(baseline.flatMap((route) => route.geometry))
  const viable = sheds
    .filter((shed) => distanceM(origin, [shed.lon, shed.lat]) + distanceM([shed.lon, shed.lat], destination) <= shortestM * (1 + maxDetour + 0.12))
    .sort((a, b) => distanceToLineM([a.lon, a.lat], origin, destination) - distanceToLineM([b.lon, b.lat], origin, destination))
    .slice(0, 5)
  const routed = await Promise.all(viable.map(async (shed) => {
    try { return (await requestWalkingRoutes([origin, [shed.lon, shed.lat], destination]))[0] } catch { return undefined }
  }))
  const unique = [...baseline, ...routed.filter((route): route is RouteCandidate => Boolean(route))]
    .filter((route, index, all) => all.findIndex((candidate) => candidate.geometry[Math.floor(candidate.geometry.length / 2)]?.join(',') === route.geometry[Math.floor(route.geometry.length / 2)]?.join(',')) === index)
  return unique
    .map((route, index) => coveredScore({ ...route, id: `covered-route-${index + 1}` }, sheds, shortestM, maxDetour))
    .sort((a, b) => b.score - a.score)
}
