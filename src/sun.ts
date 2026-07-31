import type { LonLat } from './types'

const rad = (degrees: number) => degrees * Math.PI / 180
const deg = (radians: number) => radians * 180 / Math.PI

export interface SunPosition {
  altitude: number
  azimuth: number
}

export function sunPosition(at: Date, [, lat]: LonLat): SunPosition {
  const dayMs = 86400000
  const start = Date.UTC(at.getUTCFullYear(), 0, 0)
  const day = (at.getTime() - start) / dayMs
  const gamma = 2 * Math.PI / 365 * (day - 1 + (at.getUTCHours() - 12) / 24)
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
    - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
    - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma)
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma)
    - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma))
  const minutes = at.getUTCHours() * 60 + at.getUTCMinutes()
  const trueSolarMinutes = (minutes + eqTime - 4 * 74.006) % 1440
  const hourAngle = rad(trueSolarMinutes / 4 - 180)
  const latRad = rad(lat)
  const cosZenith = Math.sin(latRad) * Math.sin(decl) + Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)))
  const altitude = 90 - deg(zenith)
  const azimuth = (deg(Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latRad) - Math.tan(decl) * Math.cos(latRad))) + 180) % 360
  return { altitude, azimuth }
}

export function localDateTimeValue(date = new Date()): string {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return shifted.toISOString().slice(0, 16)
}
