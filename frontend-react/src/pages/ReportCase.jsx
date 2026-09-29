import { useState, useRef } from 'react'
import { Phone, Navigation, Mic, MicOff, X } from 'lucide-react'
import { api } from '../api/client.js'
import RiskStamp from '../components/RiskStamp.jsx'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { species as speciesLabels, symptoms as symptomLabels, diseases as diseaseLabels } from '../i18n/translations.js'
import { SPECIES_SYMPTOMS } from '../utils/speciesSymptoms.js'

const SPECIES = ['cattle', 'buffalo', 'goat', 'sheep', 'poultry', 'pig']

// Temporary medication guide keyed by disease key
const TEMP_MEDS = {
  fmd: {
    name: 'Foot & Mouth Disease',
    meds: [
      { drug: 'Povidone-Iodine wash', dose: 'Dilute 1:10 with water', freq: 'Wash affected hooves/mouth twice daily', note: 'Keep wounds clean and dry' },
      { drug: 'Paracetamol (Veterinary)', dose: '15–20 mg/kg body weight', freq: 'Twice daily for fever', note: 'Do NOT use human tablets with additives' },
      { drug: 'Vitamin B-complex injection', dose: '10–20 ml IM', freq: 'Once daily for 3 days', note: 'Supports recovery and appetite' },
    ],
  },
  hs: {
    name: 'Hemorrhagic Septicemia',
    meds: [
      { drug: 'Penicillin-Streptomycin (Vet)', dose: '5–10 mg/kg IM', freq: 'Twice daily for 5 days', note: 'Seek vet IMMEDIATELY — this disease is rapidly fatal' },
      { drug: 'Antipyretic (Meloxicam Vet)', dose: '0.5 mg/kg SC/IM', freq: 'Once daily', note: 'To reduce fever and inflammation' },
    ],
  },
  bq: {
    name: 'Black Quarter',
    meds: [
      { drug: 'Penicillin G (Vet)', dose: '22,000 IU/kg IM', freq: 'Every 6–8 hrs (first 24 hrs)', note: 'Time-critical — must start within hours of symptoms' },
      { drug: 'Anti-inflammatory (Flunixin)', dose: '1.1–2.2 mg/kg IV', freq: 'Once daily', note: 'For pain and swelling reduction' },
    ],
  },
  anthrax: {
    name: 'Anthrax',
    meds: [
      { drug: 'Penicillin G (Vet)', dose: '10,000–20,000 IU/kg IV', freq: 'Every 6 hrs for at least 5 days', note: '⚠️ Zoonotic risk — wear gloves, report to authorities' },
    ],
  },
  ppr: {
    name: 'Peste des Petits Ruminants',
    meds: [
      { drug: 'ORS (Oral Rehydration Salts)', dose: '2–4 L/day orally', freq: 'Throughout the day in small amounts', note: 'Prevents dehydration from diarrhea' },
      { drug: 'Oxytetracycline (Vet)', dose: '10 mg/kg IM', freq: 'Once daily for 5 days', note: 'Controls secondary bacterial infections' },
      { drug: 'Antipyretic (Paracetamol Vet)', dose: '10–15 mg/kg', freq: 'Twice daily', note: 'To manage high fever' },
    ],
  },
  brucellosis: {
    name: 'Brucellosis',
    meds: [
      { drug: 'Oxytetracycline (Vet)', dose: '10 mg/kg IM', freq: 'Once daily for 21 days', note: '⚠️ Zoonotic — avoid handling aborted material without gloves' },
    ],
  },
  mastitis: {
    name: 'Mastitis',
    meds: [
      { drug: 'Intramammary Antibiotic tube', dose: 'Per tube (follow label)', freq: 'After each milking for 3–5 days', note: 'Do not consume milk during treatment + 4 days after' },
      { drug: 'Oxytocin (Vet)', dose: '10–20 IU IM', freq: 'Before milking to aid let-down', note: 'Helps flush bacteria' },
    ],
  },
  bloat: {
    name: 'Bloat / Ruminal Tympany',
    meds: [
      { drug: 'Simethicone / Tympanol', dose: '50–100 ml orally', freq: 'Single dose, repeat if no relief in 30 min', note: 'Walk the animal gently; keep head elevated' },
      { drug: 'Turpentine Oil (1 tbsp in vegetable oil)', dose: '30–60 ml orally', freq: 'Single dose', note: 'Only if commercial anti-bloat unavailable' },
    ],
  },
  default: {
    name: 'General Supportive Care',
    meds: [
      { drug: 'ORS (Oral Rehydration Salts)', dose: '2–4 L/day', freq: 'Throughout the day', note: 'Prevents dehydration' },
      { drug: 'Paracetamol (Veterinary)', dose: '15 mg/kg', freq: 'Twice daily for fever', note: 'Do NOT use human tablets' },
      { drug: 'Vitamin B-complex injection', dose: '10 ml IM', freq: 'Once daily for 3 days', note: 'Boosts immunity and recovery' },
    ],
  },
}

function getTempMeds(possibleDiseasesJson) {
  if (!possibleDiseasesJson) return TEMP_MEDS.default
  try {
    const diseases = JSON.parse(possibleDiseasesJson)
    if (!diseases.length) return TEMP_MEDS.default
    const topKey = diseases[0]?.key
    return TEMP_MEDS[topKey] || TEMP_MEDS.default
  } catch { return TEMP_MEDS.default }
}

const emptyForm = {
  species: 'cattle',
  breed: '',
  ageMonths: '',
  ownerName: '',
  ownerPhone: '',
  village: '',
  vaccinated: false,
  height: '',
  weight: '',
  unit: 'cm/kg',
  daysSinceOnset: '0',
  photoUrl: '',
}

export default function ReportCase() {
  const { t, lang } = useLanguage()
  const speciesDict = speciesLabels[lang] || speciesLabels.en
  const symptomDict = symptomLabels[lang] || symptomLabels.en
  const diseaseDict = diseaseLabels[lang] || diseaseLabels.en
  const [form, setForm] = useState(emptyForm)
  const symptomKeysForSpecies = SPECIES_SYMPTOMS[form.species] || SPECIES_SYMPTOMS.cattle
  const [symptoms, setSymptoms] = useState([])
  const [customSymptom, setCustomSymptom] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [locating, setLocating] = useState(false)
  const [coords, setCoords] = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoBase64, setPhotoBase64] = useState(null)
  const [analyzingPhoto, setAnalyzingPhoto] = useState(false)
  const [photoAnalysis, setPhotoAnalysis] = useState(null)
  const [photoError, setPhotoError] = useState(null)

  // Voice reporting state
  const [voiceListening, setVoiceListening] = useState(false)
  const [voiceLang, setVoiceLang] = useState('en-IN')
  const [voiceError, setVoiceError] = useState(null)
  const recognitionRef = useRef(null)

  const VOICE_LANGS = [
    { label: 'English', value: 'en-IN' },
    { label: 'हिन्दी', value: 'hi-IN' },
    { label: 'मराठी', value: 'mr-IN' },
  ]

  const baseTextRef = useRef('')

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. Please use Chrome.')
      return
    }
    setVoiceError(null)
    const recognition = new SpeechRecognition()
    recognition.lang = voiceLang
    // On Android, continuous + interim causes duplicate words.
    // Setting continuous false makes it act like standard Google Voice Search.
    recognition.continuous = false
    recognition.interimResults = true
    recognitionRef.current = recognition
    
    // Save existing text so we don't overwrite it
    baseTextRef.current = customSymptom

    recognition.onstart = () => setVoiceListening(true)
    recognition.onend = () => setVoiceListening(false)
    recognition.onerror = (e) => {
      setVoiceError('Microphone error: ' + e.error)
      setVoiceListening(false)
    }
    recognition.onresult = (e) => {
      let currentSessionTranscript = ''
      for (let i = 0; i < e.results.length; i++) {
        currentSessionTranscript += e.results[i][0].transcript
      }
      
      // To avoid duplicates, we combine the text that existed before clicking the mic
      // with the clean transcript of the current session.
      const base = baseTextRef.current ? baseTextRef.current + ' ' : ''
      setCustomSymptom(base + currentSessionTranscript)
    }
    recognition.start()
  }

  const stopVoice = () => {
    recognitionRef.current?.stop()
    setVoiceListening(false)
  }

  const toggleSymptom = (key) => {
    setSymptoms((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]))
  }

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoAnalysis(null)
    setPhotoError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      setPhotoPreview(dataUrl)
      setPhotoBase64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  const retakePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoBase64(null)
    setPhotoAnalysis(null)
    setPhotoError(null)
  }

  const analyzePhoto = async () => {
    if (!photoBase64 || !photoFile) return
    setAnalyzingPhoto(true)
    setPhotoError(null)
    try {
      const res = await api.analyzePhoto({
        imageBase64: photoBase64,
        mediaType: photoFile.type || 'image/jpeg',
        species: form.species,
      })
      if (!res.configured) {
        setPhotoError(t.report.photoNotConfigured)
        return
      }
      if (res.imageUsable === false) {
        setPhotoAnalysis(null)
        setPhotoError(res.retakeMessage || t.report.retakePhoto)
      } else {
        setPhotoAnalysis(res)
      }
    } catch (err) {
      setPhotoError(err.message)
    } finally {
      setAnalyzingPhoto(false)
    }
  }

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError('This browser cannot share location. Enter the village name instead.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setError('Could not read your location. Enter the village name instead.')
        setLocating(false)
      }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setResult(null)

    if (symptoms.length === 0 && !customSymptom.trim()) {
      setError('Select at least one symptom or describe your problem before submitting.')
      return
    }
    if (!form.ownerName.trim() || !form.village.trim()) {
      setError('Owner name and village are required.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        species: form.species,
        breed: form.breed || null,
        ageMonths: form.ageMonths ? Number(form.ageMonths) : null,
        ownerName: form.ownerName,
        ownerPhone: form.ownerPhone || null,
        village: form.village,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        vaccinated: form.vaccinated,
        height: form.height ? Number(form.height) : null,
        weight: form.weight ? Number(form.weight) : null,
        unit: form.unit,
        daysSinceOnset: Number(form.daysSinceOnset || 0),
        photoUrl: form.photoUrl || null,
        photoAnalysisJson: photoAnalysis ? JSON.stringify(photoAnalysis) : null,
        symptoms: customSymptom.trim() ? [...symptoms, customSymptom.trim()] : symptoms,
      }
      const created = await api.reportCase(payload)
      setResult(created)
      setForm(emptyForm)
      setSymptoms([])
      setCustomSymptom('')
      setCoords(null)
      retakePhoto()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <section className="panel">
        <h2>{t.report.heading}</h2>
        <p className="hint">{t.report.hint}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div>
              <label htmlFor="species">{t.report.species}</label>
              <select
                id="species"
                value={form.species}
                onChange={(e) => {
                  const nextSpecies = e.target.value
                  setForm({ ...form, species: nextSpecies })
                  const allowed = SPECIES_SYMPTOMS[nextSpecies] || []
                  setSymptoms((prev) => prev.filter((s) => allowed.includes(s)))
                }}
              >
                {SPECIES.map((s) => <option key={s} value={s}>{speciesDict[s]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="breed">{t.report.breed}</label>
              <input id="breed" type="text" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
            </div>

            <div>
              <label htmlFor="age">{t.report.age}</label>
              <input id="age" type="number" min="0" value={form.ageMonths} onChange={(e) => setForm({ ...form, ageMonths: e.target.value })} />
            </div>
            <div>
              <label htmlFor="onset">{t.report.onset}</label>
              <input id="onset" type="number" min="0" value={form.daysSinceOnset} onChange={(e) => setForm({ ...form, daysSinceOnset: e.target.value })} />
            </div>

            <div>
              <label htmlFor="owner">{t.report.owner}</label>
              <input id="owner" type="text" value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
            </div>
            <div>
              <label htmlFor="phone">{t.report.phone}</label>
              <input id="phone" type="tel" value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} />
            </div>

            <div>
              <label htmlFor="village">{t.report.village}</label>
              <input id="village" type="text" value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} required />
            </div>
            <div>
              <label>{t.report.location}</label>
              <button type="button" className="btn-secondary" onClick={useMyLocation} disabled={locating}>
                <Navigation size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                {locating ? t.report.locating : coords ? t.report.locationCaptured : t.report.useLocation}
              </button>
            </div>

            <div className="full">
              <label>
                <input
                  type="checkbox"
                  checked={form.vaccinated}
                  onChange={(e) => setForm({ ...form, vaccinated: e.target.checked })}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                {t.report.vaccinated}
              </label>
            </div>

            <div className="full section-box">
              <label style={{ fontSize: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
                {t.report.animalSpecs || 'Animal Specifications (Optional)'}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div>
                  <label>{t.report.unit || 'Unit'}</label>
                  <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                    <option value="cm/kg">{t.report.unitMetric || 'Metric (cm / kg)'}</option>
                    <option value="inches/lbs">{t.report.unitImperial || 'Imperial (inches / lbs)'}</option>
                  </select>
                </div>
                <div>
                  <label>{t.report.height || 'Height'} ({form.unit.split('/')[0]})</label>
                  <input type="number" step="any" min="0" value={form.height} onChange={e => setForm({...form, height: e.target.value})} placeholder="e.g. 150" />
                </div>
                <div>
                  <label>{t.report.weight || 'Weight'} ({form.unit.split('/')[1]})</label>
                  <input type="number" step="any" min="0" value={form.weight} onChange={e => setForm({...form, weight: e.target.value})} placeholder="e.g. 500" />
                </div>
              </div>
            </div>

            <div className="full">
              <label>{t.report.symptomsLabel}</label>
              <div className="symptom-grid">
                {symptomKeysForSpecies.map((key) => (
                  <label key={key} className={`symptom-chip ${symptoms.includes(key) ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={symptoms.includes(key)}
                      onChange={() => toggleSymptom(key)}
                      style={{ width: 'auto' }}
                    />
                    {symptomDict[key]}
                  </label>
                ))}
              </div>
              
              <div style={{ marginTop: 18 }}>
                {/* Voice Reporting */}
                <div className="voice-report-box">
                  <div className="voice-report-header">
                    <span className="voice-report-title">
                      <Mic size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
                      {t.report.voiceReporting || 'Voice Reporting'}
                    </span>
                    <select
                      value={voiceLang}
                      onChange={e => setVoiceLang(e.target.value)}
                      className="voice-lang-select"
                    >
                      {VOICE_LANGS.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                  <p className="voice-report-hint">
                    {t.report.voiceHint || 'Press the mic and speak your symptoms in your language — it will be auto-filled below.'}
                  </p>
                  <div className="voice-controls">
                    {!voiceListening ? (
                      <button type="button" className="btn-voice" onClick={startVoice}>
                        <Mic size={18} />
                        {t.report.voiceStart || 'Start Speaking'}
                      </button>
                    ) : (
                      <button type="button" className="btn-voice listening" onClick={stopVoice}>
                        <MicOff size={18} />
                        {t.report.voiceStop || 'Stop'}
                        <span className="voice-pulse" />
                      </button>
                    )}
                    {customSymptom && (
                      <button type="button" className="btn-secondary" onClick={() => setCustomSymptom('')} title="Clear">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {voiceError && <p className="status-msg error" style={{ marginTop: 8 }}>{voiceError}</p>}
                </div>

                {/* Custom / transcribed symptom text */}
                <div style={{ marginTop: 12 }}>
                  <label>{t.report.describeSymptom || 'Describe Symptom / Voice Transcript'} <span style={{ fontWeight: 400, opacity: 0.6 }}>{t.report.describeSymptomOptional || '(Optional)'}</span></label>
                  <textarea
                    rows={3}
                    value={customSymptom}
                    onChange={e => setCustomSymptom(e.target.value)}
                    placeholder={t.report.describeSymptomPlaceholder || 'Type here, or use Voice Reporting above to speak your symptoms...'}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>

            {(
              <div className="full">
                <label>{t.report.photoLabel}</label>
                <div className="photo-upload">
                  {photoPreview && <img src={photoPreview} alt="Selected animal" className="photo-preview" />}
                  <div className="photo-actions">
                    <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                      {photoPreview ? t.report.changePhoto : t.report.choosePhoto}
                      <input type="file" accept="image/*" onChange={handlePhotoSelect} style={{ display: 'none' }} />
                    </label>
                    {photoFile && (
                      <button type="button" className="btn-secondary" onClick={analyzePhoto} disabled={analyzingPhoto}>
                        {analyzingPhoto ? t.report.analyzingPhoto : t.report.analyzePhoto}
                      </button>
                    )}
                  </div>
                </div>

                {photoError && (
                  <div className="photo-retake-notice">{photoError}</div>
                )}

                {photoAnalysis && (
                  <div className="photo-analysis-panel">
                    {photoAnalysis.visibleSigns?.length > 0 && (
                      <>
                        <div className="photo-analysis-heading">{t.report.visibleSigns}</div>
                        <ul className="photo-analysis-list">
                          {photoAnalysis.visibleSigns.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </>
                    )}
                    {photoAnalysis.possibleConditions?.length > 0 && (
                      <>
                        <div className="photo-analysis-heading">{t.report.possibleConditionsFromPhoto}</div>
                        <div className="disease-list">
                          {photoAnalysis.possibleConditions.map((c, i) => (
                            <div key={i} className="disease-row">
                              <div className="disease-info">
                                <div className="disease-name">{c.name} <span className={`likelihood-tag likelihood-${c.likelihood}`}>{c.likelihood}</span></div>
                                <div className="disease-note">{c.description}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {photoAnalysis.firstAid?.length > 0 && (
                      <>
                        <div className="photo-analysis-heading">{t.report.firstAid}</div>
                        <ul className="photo-analysis-list">
                          {photoAnalysis.firstAid.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </>
                    )}
                    <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>{photoAnalysis.disclaimer || t.report.photoDisclaimer}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && <p className="status-msg error">{error}</p>}

          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? t.report.submitting : t.report.submit}
          </button>
        </form>
      </section>

      {result && (
        <section className="panel">
          <h2>{t.report.resultHeading}</h2>
          <div className="detail" style={{ marginTop: 12 }}>
            <p style={{ marginBottom: 12 }}>
              <RiskStamp level={result.riskLevel} /> &nbsp; {t.ledger.score} {result.riskScore.toFixed(2)}
            </p>
            <dl>
              <dt>{t.report.recommendation}</dt>
              <dd>{result.recommendation}</dd>
              <dt>{t.report.why}</dt>
              <dd>{result.explanation}</dd>
              {result.flaggedSymptoms?.length > 0 && (
                <>
                  <dt>{t.report.flagged}</dt>
                  <dd>{result.flaggedSymptoms.map((k) => symptomDict[k] || k).join(', ')}</dd>
                </>
              )}
              <dt>{t.report.villageLabel}</dt>
              <dd>{result.village}</dd>
            </dl>
          </div>

          {result.possibleDiseasesJson && JSON.parse(result.possibleDiseasesJson).length > 0 && (
            <div style={{ marginTop: 18 }}>
              <h2 style={{ fontSize: 16, marginBottom: 6 }}>{t.report.possibleDiseasesHeading}</h2>
              <p className="hint" style={{ marginBottom: 12 }}>{t.report.diseaseDisclaimer}</p>
              <div className="disease-list">
                {JSON.parse(result.possibleDiseasesJson).map((d, i) => {
                  const translated = diseaseDict[d.key]
                  return (
                    <div key={i} className="disease-row">
                      <div className="disease-info">
                        <div className="disease-name">{translated ? translated.name : d.name} <span className="disease-percent">{d.matchPercent}%</span></div>
                        <div className="disease-note">{translated ? translated.note : d.note}</div>
                      </div>
                      <div className="disease-bar-track">
                        <div className="disease-bar-fill" style={{ width: `${d.matchPercent}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {/* ── Temporary Medication (HIGH / CRITICAL only) ── */}
          {['high', 'critical'].includes(result.riskLevel?.toLowerCase()) && (() => {
            const guide = getTempMeds(result.possibleDiseasesJson)
            return (
              <div className="temp-meds-panel">
                <div className="temp-meds-header">
                  <span className="temp-meds-icon">⚕️</span>
                  <div>
                    <div className="temp-meds-title">{t.report.tempMedsTitle || 'Temporary Medication Guide'}</div>
                    <div className="temp-meds-sub">{t.report.tempMedsSub || 'For:'} <strong>{guide.name}</strong> {t.report.tempMedsAwaiting || '— while awaiting veterinary care'}</div>
                  </div>
                </div>

                <div className="temp-meds-warning">
                  ⚠️ <strong>{t.report.tempMedsFirstAidOnly || 'This is first-aid only.'}</strong> {t.report.tempMedsWarning || 'Contact a vet immediately. Do not replace professional diagnosis with this guide.'}
                </div>

                <div className="temp-meds-list">
                  {guide.meds.map((m, i) => (
                    <div key={i} className="temp-med-row">
                      <div className="temp-med-name">{m.drug}</div>
                      <div className="temp-med-details">
                        <span className="temp-med-tag">{t.report.dose || 'Dose'}</span> {m.dose}
                        <span className="temp-med-tag" style={{ marginLeft: 10 }}>{t.report.frequency || 'Frequency'}</span> {m.freq}
                      </div>
                      {m.note && <div className="temp-med-note">📌 {m.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </section>
      )}

      <div className="helpline-banner">
        <div>
          <div className="title">{t.report.helplineTitle}</div>
          <div className="text">{t.report.helplineText}</div>
        </div>
        <a className="helpline-call-btn" href="tel:1962">
          <Phone size={15} />
          {t.report.helplineCall}
        </a>
      </div>
    </>
  )
}
