import { X } from 'lucide-react'

export function AuthModal({
  authModal, setAuthModal,
  authTab, setAuthTab,
  authForm, setAuthForm,
  authError, setAuthError,
  authLoading,
  locale,
  handleAuthSubmit,
}) {
  if (!authModal) return null
  return (
    <div className="product-modal-overlay" onMouseDown={() => setAuthModal(null)}>
      <div className="auth-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setAuthModal(null)}>
          <X size={14} />
        </button>
        <div className="auth-tabs">
          <button type="button" className={authTab === 'login' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => { setAuthTab('login'); setAuthError('') }}>{locale.loginTitle}</button>
          <button type="button" className={authTab === 'register' ? 'auth-tab active' : 'auth-tab'}
            onClick={() => { setAuthTab('register'); setAuthError('') }}>{locale.registerTitle}</button>
        </div>
        <form onSubmit={handleAuthSubmit} className="auth-form">
          {authTab === 'register' ? (
            <>
              {!authForm.is_private && (
                <label>Компанија
                  <input type="text" value={authForm.company_name} onChange={e => setAuthForm(p => ({ ...p, company_name: e.target.value }))} />
                </label>
              )}
              <label className="auth-checkbox-label">
                <input type="checkbox" checked={authForm.is_private}
                  onChange={e => setAuthForm(p => ({ ...p, is_private: e.target.checked, company_name: '' }))} />
                Приватно лице
              </label>
              <label>{locale.name}
                <input type="text" required value={authForm.name} onChange={e => setAuthForm(p => ({ ...p, name: e.target.value }))} />
              </label>
              <label>Телефон
                <input type="tel" required value={authForm.phone} onChange={e => setAuthForm(p => ({ ...p, phone: e.target.value }))} placeholder="+389 XX XXX XXX" />
              </label>
              <label>{locale.email}
                <input type="email" required value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
              </label>
              <label>{locale.password}
                <input type="password" required minLength={6} value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
              </label>
              <label>Потврди лозинка
                <input type="password" required minLength={6} value={authForm.confirm_password} onChange={e => setAuthForm(p => ({ ...p, confirm_password: e.target.value }))} />
              </label>
            </>
          ) : (
            <>
              <label>{locale.email}
                <input type="email" required value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
              </label>
              <label>{locale.password}
                <input type="password" required minLength={6} value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
              </label>
            </>
          )}
          {authError && <p className="auth-error">{authError}</p>}
          <button type="submit" className="btn-auth-submit" disabled={authLoading}>
            {authLoading ? '…' : authTab === 'login' ? locale.loginBtn : locale.registerBtn}
          </button>
          <p className="auth-switch">
            {authTab === 'login' ? locale.noAccount : locale.hasAccount}{' '}
            <button type="button" className="link-btn" onClick={() => { setAuthTab(authTab === 'login' ? 'register' : 'login'); setAuthError('') }}>
              {authTab === 'login' ? locale.registerTitle : locale.loginTitle}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
