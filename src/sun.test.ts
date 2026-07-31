import { describe, expect, it } from 'vitest'
import { sunPosition } from './sun'
import { decodePolyline } from './routing'

describe('sun model', () => {
  it('places the summer midday sun above NYC', () => {
    const sun = sunPosition(new Date('2026-07-31T17:00:00Z'), [-73.98, 40.69])
    expect(sun.altitude).toBeGreaterThan(55)
    expect(sun.azimuth).toBeGreaterThan(150)
    expect(sun.azimuth).toBeLessThan(260)
  })
})

describe('polyline decoding', () => {
  it('decodes a known precision-5 polyline', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5)).toEqual([
      [-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252],
    ])
  })
})
