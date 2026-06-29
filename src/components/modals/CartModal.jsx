import { CheckCircle2, Minus, Plus, ShoppingCart, Truck, X } from 'lucide-react'

export function CartModal({
  cartOpen, setCartOpen,
  cartItems,
  totalPrice,
  authUser,
  orderNote, setOrderNote,
  orderSuccess, orderResult,
  locale,
  language,
  updateQuantity,
  removeFromCart,
  placeOrder,
}) {
  if (!cartOpen) return null
  return (
    <div className="product-modal-overlay" onMouseDown={() => setCartOpen(false)}>
      <div className="cart-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setCartOpen(false)}><X size={14} /></button>
        <h2><ShoppingCart size={17} />{locale.cartTitle}</h2>

        {orderSuccess && orderResult ? (
          <div className="order-success-full">
            <div className="order-success-banner">
              <CheckCircle2 size={18} />
              {locale.orderSuccess}
            </div>
            <p className="order-success-meta">
              {locale.orderDate}: {orderResult.date} · Нарачка #{orderResult.id}
            </p>
          </div>
        ) : (
          <>
            {!authUser && <p className="cart-note">{locale.checkoutNote}</p>}

            {cartItems.length === 0 ? (
              <div className="empty-state" style={{ border: 'none', padding: '32px 0' }}>
                <ShoppingCart size={36} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
                <p>{locale.emptyCart}</p>
              </div>
            ) : (
              <>
                <div className="cart-list">
                  {cartItems.map(item => (
                    <div key={item.productId} className="cart-item">
                      <div>
                        <h3>{item.product.name[language]}</h3>
                        <p style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{item.product.sku}</p>
                        <p>{item.product.price.toFixed(2)} € / ед.</p>
                      </div>
                      <div className="cart-actions">
                        <div className="cart-qty">
                          <button type="button" className="cart-qty__btn"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                            <Minus size={12} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateQuantity(item.productId, Number(e.target.value))}
                          />
                          <button type="button" className="cart-qty__btn"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                            <Plus size={12} />
                          </button>
                        </div>
                        <button type="button" className="remove" onClick={() => removeFromCart(item.productId)}>
                          {locale.remove}
                        </button>
                      </div>
                      <div className="cart-subtotal">{item.subtotal.toFixed(2)} €</div>
                    </div>
                  ))}
                </div>

                <div className="cart-footer">
                  <span>{locale.total}</span>
                  <strong>{totalPrice.toFixed(2)} €</strong>
                </div>

                <div className="cart-order-section">
                  <textarea
                    className="cart-note-input"
                    value={orderNote}
                    onChange={e => setOrderNote(e.target.value)}
                    placeholder={locale.orderNote}
                    rows={2}
                  />
                  <div className="cart-modal-actions">
                    <button type="button" className="btn-place-order" onClick={placeOrder}>
                      <Truck size={15} />
                      {locale.placeOrder}
                    </button>
                    <button type="button" className="btn-continue-order" onClick={() => setCartOpen(false)}>
                      {locale.continueOrder}
                    </button>
                  </div>
                  {!authUser && <p className="cart-login-hint">{locale.checkoutNote}</p>}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
