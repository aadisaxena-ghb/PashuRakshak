import { NavLink, useLocation } from 'react-router-dom'
import { ClipboardList, BookOpen, Stethoscope, MapPinned, Syringe } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageContext.jsx'
import { useRef, useEffect, useState } from 'react'

export default function Nav() {
  const { t } = useLanguage()
  const location = useLocation()
  const navRef = useRef(null)
  const [indicatorStyle, setIndicatorStyle] = useState({})

  const links = [
    { to: '/', label: t.nav.report, end: true, Icon: ClipboardList },
    { to: '/ledger', label: t.nav.ledger, Icon: BookOpen },
    { to: '/vaccines', label: t.nav.vaccines, Icon: Syringe },
    { to: '/vets', label: t.nav.vets, Icon: Stethoscope },
    { to: '/find-a-vet', label: t.nav.map, Icon: MapPinned },
  ]

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector('a.nav-active')
    if (!active) return
    const navRect = nav.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    setIndicatorStyle({
      width: activeRect.width,
      left: activeRect.left - navRect.left,
      opacity: 1,
    })
  }, [location.pathname])

  return (
    <nav className="animated-nav" ref={navRef}>
      {/* Sliding pill indicator */}
      <span className="nav-pill" style={indicatorStyle} />

      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}
        >
          <span className="nav-icon">
            <l.Icon size={16} />
          </span>
          <span className="nav-label">{l.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
