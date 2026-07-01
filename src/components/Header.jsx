import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ClipboardList, LogOut, Search, Settings, ShoppingCart } from 'lucide-react'
import logoSrc from '../assets/logo.svg'

const LANGS = [
  { code: 'mk', flag: '🇲🇰', title: 'Македонски' },
  { code: 'sr', flag: '🇷🇸', title: 'Српски' },
  { code: 'sq', flag: '🇦🇱', title: 'Shqip' },
  { code: 'en', flag: '🇬🇧', title: 'English' },
]

export function Header({
  language, setLanguage,
  search, setSearch,
  locale,
  authUser, isAdmin,
  adminOpen,
  totalCartQty, cartAnimKey,
  onOpenAuthModal, onLogout,
  onOpenMyOrders,
  onOpenCart,
  onToggleAdmin,
}) {
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef(null)
  const currentLang = LANGS.find(l => l.code === language) || LANGS[0]

  useEffect(() => {
    if (!langOpen) return
    const onClickOutside = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [langOpen])

  return (
    <header className="catalog-header">
      <div className="catalog-header__inner">

        {/* Logo */}
        <div className="header-logo">
          <img src={logoSrc} alt="GOMATIC Tools" className="header-logo__img" />
        </div>

        {/* Search */}
        <div className="header-search">
          <Search size={15} className="header-search__icon" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={locale.searchPlaceholder}
          />
        </div>

        {/* Actions */}
        <div className="header-actions">
          <div className="lang-switch" ref={langRef}>
            <button type="button" title={currentLang.title}
              className={`lang-switch__current${langOpen ? ' open' : ''}`}
              onClick={() => setLangOpen(o => !o)}
            >
              {currentLang.flag}
              <ChevronDown size={12} />
            </button>
            {langOpen && (
              <div className="lang-switch__menu">
                {LANGS.filter(l => l.code !== language).map(l => (
                  <button key={l.code} type="button" title={l.title}
                    className="lang-switch__option"
                    onClick={() => { setLanguage(l.code); setLangOpen(false) }}
                  >{l.flag}</button>
                ))}
              </div>
            )}
          </div>

          {authUser ? (
            <>
              <span className="header-user-name">{authUser.name}</span>
              {authUser.role !== 'admin' && (
                <button type="button" className="btn-auth-outline" onClick={onOpenMyOrders}>
                  <ClipboardList size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  {locale.myOrders}
                </button>
              )}
              <button type="button" className="btn-auth-outline" onClick={onLogout}>
                <LogOut size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                {locale.logout}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-auth-outline" onClick={() => onOpenAuthModal('login')}>{locale.login}</button>
              <button type="button" className="btn-auth" onClick={() => onOpenAuthModal('register')}>{locale.register}</button>
            </>
          )}

          {authUser?.role !== 'admin' && (
            <button type="button" className="btn-cart" onClick={onOpenCart}>
              <span key={cartAnimKey} className="cart-icon-bump"><ShoppingCart size={15} /></span>
              {locale.cartTitle}
              {totalCartQty > 0 && <span className="cart-badge">{totalCartQty}</span>}
            </button>
          )}

          {authUser?.role === 'admin' && (
            <button type="button" className="admin-toggle" onClick={onToggleAdmin}>
              <Settings size={13} />
              {adminOpen ? 'Затвори' : 'Admin'}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
