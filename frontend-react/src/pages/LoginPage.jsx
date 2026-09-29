import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleManualLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    
    try {
      const res = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login failed')
      
      onLogin(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setError(null)
    setLoading(true)
    
    try {
      // Mocking Google OAuth response
      const mockGoogleProfile = {
        email: 'farmer@example.com',
        name: 'Kisan Kumar'
      }
      
      const res = await fetch('http://localhost:8080/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockGoogleProfile)
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Google Login failed')
      
      onLogin(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrapper page-transition">
      <div className="login-card">
        <div className="login-header">
          <div className="brand-mark login-brand">
            <ShieldCheck size={32} />
          </div>
          <h1>PashuRakshak</h1>
          <p>Livestock Health & Disease Surveillance</p>
        </div>

        <button 
          className="google-btn" 
          onClick={handleGoogleLogin} 
          disabled={loading}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="google-icon" />
          Continue with Google
        </button>

        <div className="login-divider">
          <span>or sign in with email</span>
        </div>

        <form onSubmit={handleManualLogin} className="login-form">
          <div className="form-group">
            <label>Email address</label>
            <input 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              placeholder="name@example.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              placeholder="••••••••"
            />
          </div>
          
          {error && <div className="status-msg error">{error}</div>}
          
          <button type="submit" className="btn-primary login-submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
