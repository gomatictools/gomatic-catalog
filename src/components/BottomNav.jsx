import { AlignJustify, LayoutGrid, Settings, ShoppingCart, User } from 'lucide-react'

export function BottomNav({
  isAdmin,
  adminOpen,
  cartOpen,
  categoriesOpen,
  authModal,
  authUser,
  totalCartQty,
  onSelectAll,
  onToggleCategories,
  onToggleAdmin,
  onOpenCart,
  onAuthAction,
}) {
  return (
    <nav
      className="bottom-nav"
      aria-label="Мобилна навигација"
      style={{
        display: 'flex', position: 'fixed', bottom: 0, left: 0, right: 0, height: '58px',
        background: '#0B1C36', zIndex: 9999, borderTop: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <button
        type="button"
        className={`bottom-nav__tab${!categoriesOpen && !cartOpen && !authModal && !adminOpen ? ' active' : ''}`}
        onClick={() => { onSelectAll(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
      >
        <LayoutGrid size={22} />
        <span>Каталог</span>
      </button>
      <button
        type="button"
        className={`bottom-nav__tab${categoriesOpen ? ' active' : ''}`}
        onClick={onToggleCategories}
      >
        <AlignJustify size={22} />
        <span>Категории</span>
      </button>
      {isAdmin ? (
        <button
          type="button"
          className={`bottom-nav__tab${adminOpen ? ' active' : ''}`}
          onClick={onToggleAdmin}
        >
          <Settings size={22} />
          <span>Admin</span>
        </button>
      ) : (
        <button
          type="button"
          className={`bottom-nav__tab${cartOpen ? ' active' : ''}`}
          onClick={onOpenCart}
        >
          <span className="bottom-nav__icon-wrap">
            <ShoppingCart size={22} />
            {totalCartQty > 0 && <span className="bottom-nav__badge">{totalCartQty}</span>}
          </span>
          <span>Кошничка</span>
        </button>
      )}
      <button
        type="button"
        className={`bottom-nav__tab${!!authModal ? ' active' : ''}`}
        onClick={onAuthAction}
      >
        <User size={22} />
        <span>{authUser ? (isAdmin ? 'Одјави се' : 'Профил') : 'Пријави се'}</span>
      </button>
    </nav>
  )
}
