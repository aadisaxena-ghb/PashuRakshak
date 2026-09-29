import { useState, useEffect } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck, PhoneCall, MapPinned, Sparkles } from 'lucide-react'
import Nav from './components/Nav.jsx'
import Footer from './components/Footer.jsx'
import LanguageSwitcher from './components/LanguageSwitcher.jsx'
import HeroIllustration from './components/HeroIllustration.jsx'
import ReportCase from './pages/ReportCase.jsx'
import CaseLedger from './pages/CaseLedger.jsx'
import VetDesk from './pages/VetDesk.jsx'
import VetLocator from './pages/VetLocator.jsx'
import VaccinationGuide from './pages/VaccinationGuide.jsx'
import { useLanguage } from './i18n/LanguageContext.jsx'

/* ── Custom glowing cursor (desktop only) ── */
function CustomCursor() {
  useEffect(() => {
    const cursor = document.querySelector('.custom-cursor')
    if (!cursor) return
    const move = (e) => {
      cursor.style.left = e.clientX + 'px'
      cursor.style.top = e.clientY + 'px'
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])
  return <div className="custom-cursor" />
}

/* ── Floating ambient particles behind hero ── */
const PARTICLES = [
  { size: 90, top: '10%', left: '8%', dur: '8s', delay: '0s' },
  { size: 60, top: '60%', left: '5%', dur: '11s', delay: '-3s' },
  { size: 120, top: '20%', left: '80%', dur: '9s', delay: '-5s' },
  { size: 50, top: '70%', left: '75%', dur: '7s', delay: '-1s' },
  { size: 80, top: '45%', left: '50%', dur: '13s', delay: '-7s' },
]

/* ── Page-transition key from route ── */
function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div key={location.pathname} className="page-transition">
      <Routes location={location}>
        <Route path="/" element={<ReportCase />} />
        <Route path="/ledger" element={<CaseLedger />} />
        <Route path="/vaccines" element={<VaccinationGuide />} />
        <Route path="/vets" element={<VetDesk />} />
        <Route path="/find-a-vet" element={<VetLocator />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const { t } = useLanguage()
  const [photoFailed, setPhotoFailed] = useState(false)
  return (
    <div className="shell">
      <CustomCursor />

      {/* ── Glass sticky top bar ── */}
      <div className="masthead-top">
        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1>{t.appName}</h1>
            <div className="subtitle">{t.tagline}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <LanguageSwitcher />
        </div>
      </div>

      {/* ── Hero with parallax bg + particles ── */}
      <section className="hero">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="hero-particle"
            style={{
              width: p.size,
              height: p.size,
              top: p.top,
              left: p.left,
              background: 'radial-gradient(circle, #10b981, transparent)',
              animationDuration: p.dur,
              animationDelay: p.delay,
            }}
          />
        ))}

        <div className="hero-copy">
          <h2 className="hero-title">{t.appName}</h2>
          <p className="hero-sub">{t.tagline}</p>
          <div className="hero-badges">
            <span className="hero-badge"><ShieldCheck size={14} /> {t.heroBadges.risk}</span>
            <span className="hero-badge"><MapPinned size={14} /> {t.heroBadges.vets}</span>
            <span className="hero-badge"><PhoneCall size={14} /> {t.heroBadges.helpline}</span>
          </div>
        </div>

        {photoFailed ? (
          <HeroIllustration className="hero-illustration" />
        ) : (
          <img
            src="/images/hero-bg.jpg"
            alt="Indian farmer with healthy livestock"
            className="hero-illustration"
            onError={() => setPhotoFailed(true)}
          />
        )}

        {/* Scroll indicator */}
        <div className="scroll-indicator">
          <div className="mouse" />
          <span>Scroll</span>
        </div>
      </section>

      {/* ── Animated Nav bar ── */}
      <header className="masthead">
        <Nav />
      </header>

      {/* ── Animated page transitions ── */}
      <AnimatedRoutes />

      <Footer />
    </div>
  )
}
