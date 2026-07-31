import type { LonLat } from './types'

const EARTH_M = 6371000
const toRad = (v: number) => v * Math.PI / 180

export function distanceM(a: LonLat, b: LonLat): number {
  const dLat = toRad(b[1] - a[1])
  const dLon = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.sqrt(h))
}

export function bearing(a: LonLat, b: LonLat): number {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]))
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1]))
    - Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]))
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

export function sampleLine(points: LonLat[], spacingM = 45): LonLat[] {
  const samples: LonLat[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const length = distanceM(a, b)
    const count = Math.max(1, Math.ceil(length / spacingM))
    for (let j = 0; j < count; j++) {
      const t = j / count
      samples.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  if (points.length) samples.push(points[points.length - 1])
  return samples
}

export function bbox(points: LonLat[], padding = 0.0012): [number, number, number, number] {
  const lons = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  return [Math.min(...lons) - padding, Math.min(...lats) - padding, Math.max(...lons) + padding, Math.max(...lats) + padding]
}

export function angularDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180)
}
