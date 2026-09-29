import { useEffect, useState, useMemo } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { api } from '../api/client.js'
import RiskStamp from '../components/RiskStamp.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { species as speciesLabels, caseStatuses } from '../i18n/translations.js'
import { distanceKm } from '../utils/geo.js'

export default function VetDesk() {
  const { t, lang } = useLanguage()
  const speciesDict = speciesLabels[lang] || speciesLabels.en
  const statusDict = caseStatuses[lang] || caseStatuses.en
  const [vets, setVets] = useState([])
  const [cases, setCases] = useState([])
  const [error, setError] = useState(null)
  const [newVet, setNewVet] = useState({ name: '', phone: '', assignedRegion: '', latitude: null, longitude: null })
  const [assigning, setAssigning] = useState(null)
  const [locating, setLocating] = useState(false)
  
  const [userLocation, setUserLocation] = useState(null)
  const [userLocating, setUserLocating] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setError(null)
    try {
      const [vetList, caseList] = await Promise.all([api.listVets(), api.listCases()])
      setVets(vetList)
      setCases(caseList)
    } catch (err) {
      setError(err.message)
    }
  }

  const needsReferral = cases.filter(
    (c) => (c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL') && c.status !== 'REFERRED' && c.status !== 'RESOLVED'
  )

  const captureLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewVet((v) => ({ ...v, latitude: pos.coords.latitude, longitude: pos.coords.longitude }))
        setLocating(false)
      },
      () => setLocating(false)
    )
  }

  const getUserLocation = () => {
    if (!navigator.geolocation) return
    setUserLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setUserLocating(false)
      },
      () => setUserLocating(false)
    )
  }

  const sortedVetsRecord = useMemo(() => {
    if (!userLocation) return vets
    return [...vets].map(v => {
      if (v.latitude && v.longitude) {
        return { ...v, distanceKm: distanceKm(userLocation.latitude, userLocation.longitude, v.latitude, v.longitude) }
      }
      return v
    }).sort((a, b) => {
      if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm
      if (a.distanceKm != null) return -1
      if (b.distanceKm != null) return 1
      return 0
    })
  }, [vets, userLocation])

  const addVet = async (e) => {
    e.preventDefault()
    if (!newVet.name.trim()) return
    try {
      await api.createVet(newVet)
      setNewVet({ name: '', phone: '', assignedRegion: '', latitude: null, longitude: null })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const assign = async (caseId, vetId) => {
    setAssigning(caseId)
    try {
      await api.assignVet(caseId, Number(vetId))
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setAssigning(null)
    }
  }

  return (
    <>
      <section className="panel">
        <h2>{t.vets.waitingHeading}</h2>
        <p className="hint">{t.vets.waitingHint}</p>
        {error && <p className="status-msg error">{error}</p>}
        {needsReferral.length === 0 ? (
          <div className="empty-state">{t.vets.empty}</div>
        ) : (
          <div className="ledger">
            {needsReferral.map((c) => {
              const geoVets = vets.filter((v) => v.latitude && v.longitude)
              const sortedVets = c.latitude && c.longitude && geoVets.length > 0
                ? [...geoVets]
                    .map((v) => ({ ...v, distanceKm: distanceKm(c.latitude, c.longitude, v.latitude, v.longitude) }))
                    .sort((a, b) => a.distanceKm - b.distanceKm)
                : null
              const otherVets = sortedVets ? vets.filter((v) => !v.latitude || !v.longitude) : vets

              return (
                <div key={c.id} className="ledger-row" style={{ gridTemplateColumns: '1fr auto auto 220px' }}>
                  <div className="ledger-main">
                    <div className="animal">{speciesDict[c.animal?.species] || c.animal?.species} &middot; {c.animal?.ownerName}</div>
                    <div className="meta">{c.village}</div>
                  </div>
                  <RiskStamp level={c.riskLevel} />
                  <div className="ledger-status">{statusDict[c.status] || c.status}</div>
                  <select
                    defaultValue={sortedVets && sortedVets.length > 0 ? sortedVets[0].id : ''}
                    disabled={assigning === c.id}
                    onChange={(e) => e.target.value && assign(c.id, e.target.value)}
                  >
                    <option value="" disabled>{t.vets.assign}</option>
                    {sortedVets && sortedVets.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} — {v.distanceKm.toFixed(1)} km away{v === sortedVets[0] ? ' (nearest)' : ''}
                      </option>
                    ))}
                    {otherVets.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t.vets.onRecord}</h2>
          <button className="btn-secondary" onClick={getUserLocation} disabled={userLocating}>
            <Navigation size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
            {userLocating ? (t.vets.locating || 'Locating…') : userLocation ? (t.vets.sortedByProximity || 'Sorted by proximity ✓') : (t.vets.useMyLocation || 'Use my location')}
          </button>
        </div>
        
        <div className="ledger" style={{ marginBottom: 20 }}>
          {sortedVetsRecord.length === 0 && <div className="empty-state">{t.vets.noneYet}</div>}
          {sortedVetsRecord.map((v) => (
            <div key={v.id} className="ledger-row" style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
              <div className="ledger-main">
                <div className="animal">{v.name}</div>
                {v.distanceKm != null && <div className="meta" style={{ color: '#d97706' }}>{v.distanceKm.toFixed(1)} {t.vets.kmAway || 'km away'}</div>}
              </div>
              <div className="ledger-village">{v.assignedRegion}</div>
              <div className="ledger-village">{v.phone}</div>
              <div className="ledger-village">{v.latitude ? <MapPin size={16} color="var(--green)" /> : null}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 16, marginBottom: 12 }}>{t.vets.addHeading}</h2>
        <form onSubmit={addVet} className="form-grid">
          <div>
            <label htmlFor="vname">{t.vets.name}</label>
            <input id="vname" type="text" value={newVet.name} onChange={(e) => setNewVet({ ...newVet, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="vphone">{t.vets.phone}</label>
            <input id="vphone" type="tel" value={newVet.phone} onChange={(e) => setNewVet({ ...newVet, phone: e.target.value })} />
          </div>
          <div className="full">
            <label htmlFor="vregion">{t.vets.region}</label>
            <input id="vregion" type="text" value={newVet.assignedRegion} onChange={(e) => setNewVet({ ...newVet, assignedRegion: e.target.value })} />
          </div>
          <div className="full">
            <button type="button" className="btn-secondary" onClick={captureLocation} disabled={locating}>
              <MapPin size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {locating ? t.report.locating : newVet.latitude ? t.report.locationCaptured : t.vets.captureLocation}
            </button>
          </div>
          <div className="full">
            <button className="btn-primary" type="submit">{t.vets.add}</button>
          </div>
        </form>
      </section>
    </>
  )
}
