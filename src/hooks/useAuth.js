import { useEffect, useState } from 'react'
import { API_BASE } from '../lib/utils'

export function useAuth({ setError }) {
  const [authUser, setAuthUser] = useState(null)
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token'))
  const [authModal, setAuthModal] = useState(null)
  const [authTab, setAuthTab] = useState('login')
  const [authForm, setAuthForm] = useState({
    email: '', name: '', password: '', confirm_password: '',
    company_name: '', is_private: false, phone: '',
  })
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const isAdmin = authUser?.role === 'admin'

  useEffect(() => {
    if (!authToken) { setAuthUser(null); return }
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setAuthUser(data.user)
        else { setAuthToken(null); localStorage.removeItem('auth_token') }
      })
      .catch(() => { setAuthToken(null); localStorage.removeItem('auth_token') })
  }, [authToken])

  const openAuthModal = (tab = 'login') => {
    setAuthTab(tab)
    setAuthForm({ email: '', name: '', password: '', confirm_password: '', company_name: '', is_private: false, phone: '' })
    setAuthError('')
    setAuthModal(true)
  }

  const handleAuthSubmit = async (ev) => {
    ev.preventDefault()
    setAuthError('')
    if (authTab === 'register' && authForm.password !== authForm.confirm_password) {
      setAuthError('Лозинките не се совпаѓаат.'); return
    }
    setAuthLoading(true)
    try {
      const endpoint = authTab === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = authTab === 'login'
        ? { email: authForm.email, password: authForm.password }
        : {
            email: authForm.email, name: authForm.name, password: authForm.password,
            company_name: authForm.company_name, is_private: authForm.is_private, phone: authForm.phone,
          }
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setAuthError(data.error || 'Грешка'); return }
      localStorage.setItem('auth_token', data.token)
      setAuthToken(data.token)
      setAuthUser(data.user)
      setAuthModal(null)
    } catch {
      setAuthError('Проблем со врска со серверот.')
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = (onLogoutExtra) => {
    setAuthUser(null); setAuthToken(null)
    localStorage.removeItem('auth_token')
    if (onLogoutExtra) onLogoutExtra()
  }

  return {
    authUser,
    authToken,
    authModal, setAuthModal,
    authTab, setAuthTab,
    authForm, setAuthForm,
    authError, setAuthError,
    authLoading,
    isAdmin,
    openAuthModal,
    handleAuthSubmit,
    logout,
  }
}
