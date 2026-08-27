import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

type Mode = 'login' | 'register' | 'success'

// Accepts 0712345678 · +255712345678 · 255712345678 · 712345678
const formatPhone = (val: string) => {
  let digits = val.replace(/\D/g, '')
  if (digits.startsWith('255') && digits.length >= 12) digits = '0' + digits.slice(3)
  else if (!digits.startsWith('0') && digits.length === 9) digits = '0' + digits
  return digits
}

export default function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Registration fields
  const [fullName, setFullName] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)

  const { login, register, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && user) {
      navigate(user.role === 'ADMIN' ? '/admin' : '/', { replace: true })
    }
  }, [user, authLoading, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await login(phone, password)
      setLoading(false)
      if (result.error) setError(result.error)
    } catch (err) {
      setLoading(false)
      setError('Kuna kitu hakifanyi kazi. Tafadhali jaribu tena.')
      console.error('Login exception:', err)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) return setError('Tafadhali weka jina lako kamili.')
    if (regPhone.length < 10) return setError('Tafadhali weka namba sahihi ya simu.')
    if (!region.trim()) return setError('Tafadhali weka mkoa wako.')
    if (regPassword.length < 6) return setError('Neno la siri linahitaji herufi angalau 6.')
    if (regPassword !== confirmPassword) return setError('Maneno ya siri hayalingani.')

    setLoading(true)
    try {
      const result = await register({
        fullName,
        phone: regPhone,
        region,
        city,
        password: regPassword,
      })
      setLoading(false)
      if (result.error) {
        setError(result.error)
      } else {
        setMode('success')
      }
    } catch (err) {
      setLoading(false)
      setError('Kuna kitu hakifanyi kazi. Tafadhali jaribu tena.')
      console.error('Register exception:', err)
    }
  }

  const switchMode = (next: Mode) => {
    setError('')
    setPhone('')
    setPassword('')
    setFullName('')
    setRegPhone('')
    setRegion('')
    setCity('')
    setRegPassword('')
    setConfirmPassword('')
    setMode(next)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="card w-full max-w-sm p-6 sm:p-8">
        {mode === 'success' ? (
          /* ---------- Registration success / pending approval ---------- */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-success-50 text-success flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl" aria-hidden>✓</span>
            </div>
            <h1 className="text-xl font-bold text-text">Usajili Umefanikiwa!</h1>
            <p className="text-text-secondary text-sm mt-3 leading-relaxed">
              Hongera, akaunti yako imesajiliwa. Hata hivyo,{' '}
              <strong className="text-warning">akaunti yako bado haijaidhinishwa</strong> na .
            </p>
            <p className="text-text-secondary text-sm mt-2 leading-relaxed">
              Huwezi kuingia kwenye mfumo kwa sasa. Tafadhali subiri  aidhinishie akaunti yako,
              kisha ujaribu kuingia tena.
            </p>
            <button type="button" className="btn btn-primary w-full mt-6" onClick={() => switchMode('login')}>
              Rudi Kwenye Kuingia
            </button>
          </div>
        ) : mode === 'login' ? (
          /* ---------- Login ---------- */
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">21</span>
              </div>
              <h1 className="text-2xl font-bold text-text">2021familyforever</h1>
              <p className="text-text-secondary text-sm mt-1">Ingia kwenye akaunti yako</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Namba ya Simu / Kitambulisho</label>
                <input
                  type="text"
                  className="input"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="07XXXXXXXX"
                  required
                  maxLength={10}
                />
              </div>
              <div>
                <label className="label">Neno la Siri</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-10"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Weka neno lako la siri"
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              {error && <p className="text-error text-sm">{error}</p>}
              <button type="submit" disabled={loading || authLoading} className="btn btn-primary w-full">
                {loading ? 'Inaingia…' : 'Ingia'}
              </button>
            </form>
            <p className="text-center text-sm text-text-secondary mt-6">
              Hauna akaunti?{' '}
              <button type="button" className="font-semibold text-primary hover:text-primary-600" onClick={() => switchMode('register')}>
                Jisajili sasa
              </button>
            </p>
          </>
        ) : (
          /* ---------- Registration ---------- */
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-xl">21</span>
              </div>
              <h1 className="text-2xl font-bold text-text">Jisajili</h1>
              <p className="text-text-secondary text-sm mt-1">Tengeneza akaunti yako ya mwanachama</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="label">Jina Kamili *</label>
                <input
                  type="text"
                  className="input"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Weka jina lako kamili"
                  required
                />
              </div>
              <div>
                <label className="label">Namba ya Simu *</label>
                <input
                  type="text"
                  className="input"
                  value={regPhone}
                  onChange={e => setRegPhone(formatPhone(e.target.value))}
                  placeholder="07XXXXXXXX"
                  required
                  maxLength={10}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Mkoa *</label>
                  <input
                    type="text"
                    className="input"
                    value={region}
                    onChange={e => setRegion(e.target.value)}
                    placeholder="Mkoa"
                    required
                  />
                </div>
                <div>
                  <label className="label">Mji</label>
                  <input
                    type="text"
                    className="input"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="Mji (hiari)"
                  />
                </div>
              </div>
              <div>
                <label className="label">Neno la Siri *</label>
                <div className="relative">
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    className="input pr-10"
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Herufi angalau 6"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                    {showRegPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Rudia Neno la Siri *</label>
                <input
                  type="password"
                  className="input"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Rudia neno la siri"
                  required
                />
              </div>
              {error && <p className="text-error text-sm">{error}</p>}
              <button type="submit" disabled={loading || authLoading} className="btn btn-primary w-full">
                {loading ? 'Inasajili…' : 'Jisajili'}
              </button>
            </form>
            <p className="text-center text-sm text-text-secondary mt-6">
              Una akaunti?{' '}
              <button type="button" className="font-semibold text-primary hover:text-primary-600" onClick={() => switchMode('login')}>
                Ingia
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}