import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Phone, MapPin, Navigation, ExternalLink } from 'lucide-react'
import { api } from '../api/client.js'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { distanceKm } from '../utils/geo.js'

// Geographic center of India — a sane default before we know the user's
// location, instead of an arbitrary region that looks like a bug.
const INDIA_CENTER = [22.9734, 78.6569]
const INDIA_DEFAULT_ZOOM = 5

const userIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:16px;height:16px;border-radius:50%;background:#E8871E;border:3px solid white;box-shadow:0 0 0 2px #E8871E;"></div>',
  iconSize: [16, 16],
})

const googleVetIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#4285F4;border:2px solid white;"></div>',
  iconSize: [14, 14],
})

const instIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid white;"></div>',
  iconSize: [14, 14],
})

const MAJOR_INSTITUTES = [
  { id: 'ivri', name: 'Indian Veterinary Research Institute (IVRI)', address: 'Izatnagar, Bareilly, UP', latitude: 28.3975, longitude: 79.4313, phone: '0581-2300096' },
  { id: 'mvc', name: 'Madras Veterinary College', address: 'Vepery, Chennai, TN', latitude: 13.0849, longitude: 80.2647, phone: '044-25304000' },
  { id: 'bvc', name: 'Bombay Veterinary College', address: 'Parel, Mumbai, MH', latitude: 19.0069, longitude: 72.8398, phone: '022-24131180' },
  { id: 'gadvsu', name: 'GADVASU', address: 'Ludhiana, Punjab', latitude: 30.9010, longitude: 75.8071, phone: '0161-2414002' },
  { id: 'cgkv', name: 'Chhattisgarh Kamdhenu Vishwavidyalaya', address: 'Durg, Chhattisgarh', latitude: 21.1645, longitude: 81.3346, phone: '07826-232145' },
  { id: 'kvasu', name: 'KVASU', address: 'Wayanad, Kerala', latitude: 11.5543, longitude: 75.9818, phone: '04936-209200' },
  { id: 'cvas', name: 'College of Veterinary and Animal Sciences', address: 'Bikaner, Rajasthan', latitude: 28.0229, longitude: 73.3119, phone: '0151-2200289' },
  { id: 'gbpuat', name: 'College of Veterinary & Animal Sciences', address: 'Pantnagar, Uttarakhand', latitude: 29.0222, longitude: 79.4908, phone: '05944-233347' },
  { id: 'bihar', name: 'Bihar Veterinary College', address: 'Patna, Bihar', latitude: 25.5976, longitude: 85.0843, phone: '0612-2222231' },
  { id: 'wbuafs', name: 'WBUAFS', address: 'Kolkata, West Bengal', latitude: 22.5626, longitude: 88.3630, phone: '033-25563123' },
  { id: 'covas', name: 'Dr. GC Negi College of Vet Sciences', address: 'Palampur, Himachal Pradesh', latitude: 32.1120, longitude: 76.5360, phone: '01894-230304' },
  { id: 'ntr', name: 'NTR College of Veterinary Science', address: 'Gannavaram, Andhra Pradesh', latitude: 16.5385, longitude: 80.7963, phone: '08676-252258' },
]

// Leaflet renders patchy/half-loaded tiles when its container's real size
// isn't known at the moment it first mounts (very common inside a flex/grid
// layout like ours). invalidateSize() forces it to remeasure and repaint
// properly. We also fit the view to every marker so the whole set of vets
// is visible without the user having to manually zoom/pan.
function MapController({ points, userLocation }) {
  const map = useMap()

  useEffect(() => {
    const t1 = setTimeout(() => map.invalidateSize(), 150)
    const t2 = setTimeout(() => map.invalidateSize(), 400) // After page-transition
    const t3 = setTimeout(() => map.invalidateSize(), 800) // Fallback
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [map])

  useEffect(() => {
    if (points.length === 0) return
    
    // If we have a user location, fly directly to it nicely zoomed in
    if (userLocation) {
      map.flyTo([userLocation.latitude, userLocation.longitude], 13, {
        duration: 1.5 // 1.5 seconds animation
      })
      return
    }

    if (points.length === 1) {
      map.setView(points[0], 12)
      return
    }
    
    // Otherwise fit bounds to all points
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })
  }, [map, points, userLocation])

  return null
}

export default function VetLocator() {
  const { t } = useLanguage()
  const [registeredVets, setRegisteredVets] = useState([])
  const [googleVets, setGoogleVets] = useState([])
  const [placesConfigured, setPlacesConfigured] = useState(true)
  const [error, setError] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    api.listVets().then(setRegisteredVets).catch((err) => setError(err.message))
    // Ask for location automatically on load; the browser still shows its
    // own permission prompt, this just skips requiring an extra click.
    shareLocation()
  }, [])

  useEffect(() => {
    if (!userLocation) return
    api.nearbyVets(userLocation.latitude, userLocation.longitude)
      .then((res) => {
        setPlacesConfigured(res.configured)
        setGoogleVets(res.vets || [])
      })
      .catch((err) => setError(err.message))
  }, [userLocation])

  const shareLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setLocating(false)
        setError(null)
      },
      (err) => {
        setLocating(false)
        if (err.code === 1) {
          setError("Location access was blocked. Please click the site settings icon (near the URL) to allow location access.")
        } else if (err.code === 3) {
          setError("Location request timed out. Please try again.")
        } else {
          setError("Could not get your location. Please check your device's location settings.")
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const registeredGeo = registeredVets.filter((v) => v.latitude && v.longitude)

  // Merge both sources into one shape for the "closest to you" list.
  const allVets = useMemo(() => {
    const fromRegistry = registeredGeo.map((v) => ({
      key: `reg-${v.id}`,
      name: v.name,
      subtitle: v.assignedRegion,
      latitude: v.latitude,
      longitude: v.longitude,
      phone: v.phone,
      mapsUrl: null,
      source: 'registered',
    }))
    const fromGoogle = googleVets.map((v) => ({
      key: `g-${v.placeId}`,
      name: v.name,
      subtitle: v.address,
      latitude: v.latitude,
      longitude: v.longitude,
      phone: null,
      mapsUrl: v.mapsUrl,
      source: 'google',
    }))
    const fromInstitutes = MAJOR_INSTITUTES.map((v) => ({
      key: `inst-${v.id}`,
      name: v.name,
      subtitle: v.address,
      latitude: v.latitude,
      longitude: v.longitude,
      phone: v.phone,
      mapsUrl: null,
      source: 'institute',
      icon: instIcon,
    }))
    return [...fromRegistry, ...fromGoogle, ...fromInstitutes]
  }, [registeredGeo, googleVets])

  const sortedByDistance = useMemo(() => {
    if (!userLocation) return []
    return allVets
      .map((v) => ({ ...v, distanceKm: distanceKm(userLocation.latitude, userLocation.longitude, v.latitude, v.longitude) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [allVets, userLocation])

  const center = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : allVets.length > 0
      ? [allVets[0].latitude, allVets[0].longitude]
      : INDIA_CENTER

  const zoom = userLocation ? 11 : INDIA_DEFAULT_ZOOM

  // Map markers and fitting logic
  const mapPoints = useMemo(() => {
    const pts = []
    if (userLocation) {
      // Focus on user location and the closest 6 vets
      pts.push([userLocation.latitude, userLocation.longitude])
      sortedByDistance.slice(0, 6).forEach((v) => pts.push([v.latitude, v.longitude]))
    } else {
      // Focus on all available vets across India
      registeredGeo.forEach((v) => pts.push([v.latitude, v.longitude]))
      googleVets.forEach((v) => pts.push([v.latitude, v.longitude]))
      MAJOR_INSTITUTES.forEach((v) => pts.push([v.latitude, v.longitude]))
    }
    return pts
  }, [userLocation, sortedByDistance, registeredGeo, googleVets])

  return (
    <section className="panel">
      <h2>{t.locator.heading}</h2>
      <p className="hint">{t.locator.hint}</p>

      {error && <p className="status-msg error">{error}</p>}

      <button className="btn-primary" onClick={shareLocation} disabled={locating} style={{ marginBottom: 16 }}>
        <Navigation size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
        {locating ? t.report.locating : userLocation ? t.locator.allow + ' ↻' : t.locator.allow}
      </button>

      {!placesConfigured && (
        <p className="status-msg" style={{ marginBottom: 12 }}>
          {t.locator.liveNotConfigured}
        </p>
      )}

      {userLocation && sortedByDistance.length > 0 && (
        <div className="panel" style={{ background: 'var(--surface-tint)', boxShadow: 'none', marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>{t.locator.nearestHeading}</h2>
          <div className="ledger">
            {sortedByDistance.slice(0, 6).map((v) => (
              <div key={v.key} className="ledger-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <div className="ledger-main">
                  <div className="animal">{v.name}</div>
                  <div className="meta">{v.subtitle}</div>
                </div>
                <div className="ledger-village">{v.distanceKm.toFixed(1)} km {t.locator.away}</div>
                {v.phone ? (
                  <a className="btn-secondary" href={`tel:${v.phone}`}>
                    <Phone size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
                    {v.phone}
                  </a>
                ) : v.mapsUrl ? (
                  <a className="btn-secondary" href={v.mapsUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={13} style={{ marginRight: 6, verticalAlign: -2 }} />
                    {t.locator.mapsBtn}
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {!userLocation && <p className="status-msg">{t.locator.noLocation}</p>}

      <div className="map-wrap">
        <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
          <MapController points={mapPoints} userLocation={userLocation} />
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {userLocation && (
            <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userIcon}>
              <Popup>{t.locator.youAreHere}</Popup>
            </Marker>
          )}
          {allVets.map((v) => {
            let icon = googleVetIcon
            if (v.source === 'registered') icon = userIcon
            if (v.source === 'institute') icon = instIcon

            // If userLocation is set, only show markers that are in the top 6 closest
            if (userLocation && sortedByDistance.findIndex(x => x.key === v.key) > 5) return null

            return (
              <Marker key={v.key} position={[v.latitude, v.longitude]} icon={icon}>
                <Popup>
                  <strong>{v.name}</strong><br />
                  {v.subtitle}<br />
                  {v.phone && <a href={`tel:${v.phone}`}>{v.phone}</a>}
                  {v.mapsUrl && <a href={v.mapsUrl} target="_blank" rel="noreferrer">{t.locator.openInMaps}</a>}
                </Popup>
              </Marker>
            )
          })}
        </MapContainer>
      </div>

      {allVets.length === 0 && (
        <p className="status-msg" style={{ marginTop: 10 }}>
          <MapPin size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
          {placesConfigured
            ? t.locator.noVetsNearby
            : t.locator.noVetsRegistered}
        </p>
      )}
    </section>
  )
}
