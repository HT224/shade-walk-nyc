import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import { searchPlaces } from './data'
import { fetchWalkingRoutes, rankRoutes } from './routing'
import { localDateTimeValue, sunPosition } from './sun'
import type { Place, RouteCandidate } from './types'

const DEFAULT_ORIGIN: Place = { label: 'Fort Greene Park, Brooklyn', coordinates: [-73.9754, 40.6914] }
const DEFAULT_DESTINATION: Place = { label: 'Brooklyn Bridge Park Pier 1', coordinates: [-73.9966, 40.7024] }

function FitRoute({ route }: { route?: RouteCandidate }) {
  const map = useMap()
  useEffect(() => {
    if (!route?.geometry.length) return
    const bounds: LatLngBoundsExpression = route.geometry.map(([lon, lat]) => [lat, lon])
    map.fitBounds(bounds, { padding: [36, 36] })
  }, [map, route])
  return null
}

function AddressField({ label, value, onChange }: { label: string; value: Place | null; onChange: (place: Place) => void }) {
  const [query, setQuery] = useState(value?.label ?? '')
  const [results, setResults] = useState<Place[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      if (query.length < 3 || query === value?.label) return setResults([])
      try { setResults(await searchPlaces(query, controller.signal)); setOpen(true) } catch { setResults([]) }
    }, 260)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, value?.label])

  return <div className="address-field">
    <label>{label}</label>
    <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setOpen(true)} placeholder="Enter an NYC address" />
    {open && results.length > 0 && <div className="suggestions">
      {results.map((place) => <button key={`${place.label}-${place.coordinates.join()}`} onClick={() => {
        setQuery(place.label); onChange(place); setOpen(false); setResults([])
      }}>{place.label}</button>)}
    </div>}
  </div>
}

function formatDistance(meters: number) {
  const miles = meters / 1609.344
  return miles < 0.1 ? `${Math.round(meters)} m` : `${miles.toFixed(1)} mi`
}

function App() {
  const [origin, setOrigin] = useState<Place | null>(DEFAULT_ORIGIN)
  const [destination, setDestination] = useState<Place | null>(DEFAULT_DESTINATION)
  const [departure, setDeparture] = useState(localDateTimeValue())
  const [detour, setDetour] = useState(15)
  const [routes, setRoutes] = useState<RouteCandidate[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Ready for a cooler way across town.')

  const selected = routes.find((route) => route.id === selectedId) ?? routes[0]
  const shortest = routes.length ? Math.min(...routes.map((route) => route.distanceM)) : 0
  const sun = origin ? sunPosition(new Date(departure), origin.coordinates) : null

  async function buildRoutes() {
    if (!origin || !destination) return setStatus('Choose both an origin and destination.')
    setLoading(true)
    setStatus('Comparing streets, trees, buildings, and sun…')
    try {
      const candidates = await fetchWalkingRoutes(origin.coordinates, destination.coordinates)
      const ranked = await rankRoutes(candidates, new Date(departure), detour / 100)
      setRoutes(ranked)
      setSelectedId(ranked[0]?.id ?? '')
      setStatus(ranked.length > 1 ? `Compared ${ranked.length} valid walking routes.` : 'Found one valid walking route.')
    } catch (error) {
      setRoutes([])
      setStatus(error instanceof Error ? error.message : 'Could not calculate a route.')
    } finally { setLoading(false) }
  }

  function useLocation() {
    if (!navigator.geolocation) return setStatus('Location is not supported by this browser.')
    setStatus('Finding you…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setOrigin({ label: 'Current location', coordinates: [coords.longitude, coords.latitude] })
        setStatus('Current location set.')
      },
      () => setStatus('Could not access your location. Enter an address instead.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const routeLines = useMemo(() => routes.slice().reverse(), [routes])

  return <main>
    <header>
      <div className="brand-mark" aria-hidden="true">◒</div>
      <div><p className="eyebrow">A tiny NYC utility</p><h1>Shade Walk</h1></div>
      <span className="nyc">NYC</span>
    </header>

    <section className="hero">
      <p className="eyebrow">Walk cooler</p>
      <h2>Take the shady way.</h2>
      <p>Compare walking routes using the sun, NYC buildings, and street trees—without adding an absurd detour.</p>
    </section>

    <section className="planner card">
      <AddressField label="From" value={origin} onChange={setOrigin} />
      <button className="location" onClick={useLocation}>◎ Use my location</button>
      <AddressField label="To" value={destination} onChange={setDestination} />
      <div className="row">
        <label className="control">Leave at<input type="datetime-local" value={departure} onChange={(event) => setDeparture(event.target.value)} /></label>
        <label className="control">Max detour<select value={detour} onChange={(event) => setDetour(Number(event.target.value))}>
          <option value="5">5%</option><option value="10">10%</option><option value="15">15%</option><option value="25">25%</option>
        </select></label>
      </div>
      <button className="primary" onClick={buildRoutes} disabled={loading}>{loading ? 'Finding shade…' : 'Find a shaded route'}</button>
      <p className="status" role="status">{status}</p>
    </section>

    <section className="map-card card">
      <MapContainer center={[40.7128, -74.006]} zoom={12} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {routeLines.map((route) => <Polyline key={route.id} positions={route.geometry.map(([lon, lat]) => [lat, lon])} pathOptions={{ color: route.id === selected?.id ? '#f0b84b' : '#9aa79f', weight: route.id === selected?.id ? 7 : 4, opacity: route.id === selected?.id ? 1 : 0.58 }} />)}
        {origin && <CircleMarker center={[origin.coordinates[1], origin.coordinates[0]]} radius={7} pathOptions={{ color: '#fff', fillColor: '#173d35', fillOpacity: 1, weight: 3 }}><Tooltip>Start</Tooltip></CircleMarker>}
        {destination && <CircleMarker center={[destination.coordinates[1], destination.coordinates[0]]} radius={7} pathOptions={{ color: '#fff', fillColor: '#d75f42', fillOpacity: 1, weight: 3 }}><Tooltip>Destination</Tooltip></CircleMarker>}
        <FitRoute route={selected} />
      </MapContainer>
      <div className="sun-strip"><span>☀ {sun && sun.altitude > 0 ? `${Math.round(sun.altitude)}° above the horizon` : 'Sun below the horizon'}</span><span>Shade changes with time</span></div>
    </section>

    {routes.length > 0 && <section className="results">
      <div className="section-heading"><div><p className="eyebrow">Route comparison</p><h3>Your cooler options</h3></div><span>Estimate</span></div>
      <div className="route-list">{routes.map((route, index) => {
        const extra = shortest ? Math.max(0, Math.round((route.distanceM / shortest - 1) * 100)) : 0
        return <button className={`route-card ${route.id === selected?.id ? 'selected' : ''}`} key={route.id} onClick={() => setSelectedId(route.id)}>
          <div className="route-top"><strong>{index === 0 ? 'Most shade' : route.distanceM <= shortest * 1.001 ? 'Most direct' : 'Alternative'}</strong><span>{route.shadePercent}% likely shade</span></div>
          <div className="metrics"><span><b>{Math.round(route.durationSec / 60)}</b> min</span><span><b>{formatDistance(route.distanceM)}</b></span><span><b>{extra}%</b> extra</span></div>
          <div className="shade-bar"><i style={{ width: `${route.shadePercent}%` }} /></div>
          <small>{route.buildingShade}% building shade · {route.treeShade}% tree cover signal</small>
        </button>
      })}</div>
    </section>}

    {selected && <section className="directions card">
      <p className="eyebrow">Turn by turn</p><h3>Follow this route</h3>
      <ol>{selected.steps.map((step, index) => <li key={`${step.instruction}-${index}`}><span>{index + 1}</span><p>{step.instruction}<small>{formatDistance(step.distanceM)}</small></p></li>)}</ol>
    </section>}

    <section className="method card">
      <p className="eyebrow">How it works</p><h3>A useful estimate, not x-ray vision.</h3>
      <p>Shade Walk compares pedestrian routes against the sun’s position, NYC’s 3D Building Model / Building Footprints, and the 2015 Street Tree Census. Scaffolding, new construction, small trees, awnings, and exact sidewalk conditions may differ. Look up before committing.</p>
    </section>

    <footer>Built for hot New York walks. Data from NYC Open Data, OpenStreetMap, and Valhalla.</footer>
  </main>
}

export default App
