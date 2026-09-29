import { useState, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { species as speciesLabels, vaccineSchedule } from '../i18n/translations.js'

const SPECIES = ['cattle', 'buffalo', 'goat', 'sheep', 'poultry', 'pig']

// Vaccine schedule is now imported from translations.js

export default function VaccinationGuide() {
  const { t, lang } = useLanguage()
  const tv = t.vaccines || {}
  const speciesDict = speciesLabels[lang] || speciesLabels.en
  
  const [selectedSpecies, setSelectedSpecies] = useState('cattle')
  const schedule = useMemo(() => {
    const byLang = vaccineSchedule[lang] || vaccineSchedule.en
    return byLang[selectedSpecies] || []
  }, [lang, selectedSpecies])

  return (
    <>
      <section className="panel">
        <h2>{tv.heading || 'Vaccination Guide'}</h2>
        <p className="hint">{tv.hint || 'Select your livestock to view the recommended vaccination schedule.'}</p>

        <div className="form-grid" style={{ marginBottom: 24, marginTop: 16 }}>
          <div className="full">
            <label htmlFor="speciesSelect">{tv.speciesLabel || 'Species'}</label>
            <select
              id="speciesSelect"
              value={selectedSpecies}
              onChange={(e) => setSelectedSpecies(e.target.value)}
              style={{ maxWidth: '300px' }}
            >
              {SPECIES.map((s) => (
                <option key={s} value={s}>{speciesDict[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {schedule.length > 0 ? (
          <div className="ledger" style={{ marginTop: 0 }}>
            {schedule.map((vac, idx) => (
              <div key={idx} className="ledger-row" style={{ gridTemplateColumns: '120px 1fr 1fr' }}>
                <div className="ledger-village" style={{ fontWeight: 600, color: 'var(--green-deep)' }}>
                  {vac.age}
                </div>
                <div className="ledger-main">
                  <div className="animal">{vac.name}</div>
                  <div className="meta">{tv.booster || 'Booster'}: {vac.booster}</div>
                </div>
                <div className="ledger-status" style={{ textAlign: 'left', fontWeight: 'normal', color: 'var(--ink-muted)' }}>
                  {vac.notes}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">{tv.noData || 'No vaccination data available for this species.'}</div>
        )}

        <div className="status-msg" style={{ marginTop: 24, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertCircle size={16} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
          <span style={{ fontSize: 13, color: '#92400e' }}>
            {tv.disclaimer || 'This schedule is a general guideline. Consult your local veterinarian for region-specific requirements.'}
          </span>
        </div>
      </section>
    </>
  )
}
