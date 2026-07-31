export type LonLat = [number, number]

export interface Place {
  label: string
  coordinates: LonLat
}

export interface RouteStep {
  instruction: string
  distanceM: number
  coordinates: LonLat
}

export interface RouteCandidate {
  id: string
  geometry: LonLat[]
  distanceM: number
  durationSec: number
  shadePercent: number
  buildingShade: number
  treeShade: number
  score: number
  steps: RouteStep[]
}

export interface TreePoint {
  lon: number
  lat: number
  health?: string
}

export interface BuildingPoint {
  lon: number
  lat: number
  heightM: number
}
