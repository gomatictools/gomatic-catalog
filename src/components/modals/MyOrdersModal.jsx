import { ClipboardList, Package, X } from 'lucide-react'

export function MyOrdersModal({ myOrdersOpen, setMyOrdersOpen, myOrders, locale }) {
  if (!myOrdersOpen) return null
  return (
    <div className="product-modal-overlay" onMouseDown={() => setMyOrdersOpen(false)}>
      <div className="orders-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setMyOrdersOpen(false)}><X size={14} /></button>
        <h2><ClipboardList size={17} />{locale.ordersTitle}</h2>
        {myOrders.length === 0 ? (
          <div className="empty-state" style={{ border: 'none', padding: '32px 0' }}>
            <Package size={36} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
            <p>{locale.noOrders}</p>
          </div>
        ) : (
          <div className="orders-list">
            {myOrders.map(order => (
              <div key={order.id} className="order-card">
                <div className="order-card-header">
                  <span>#{order.id}</span>
                  <span className="order-status">{order.status}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(order.created_at).toLocaleDateString()}</span>
                  <strong style={{ marginLeft: 'auto' }}>{order.total.toFixed(2)} €</strong>
                </div>
                <ul className="order-items-list">
                  {order.items.map(item => (
                    <li key={item.id}>{item.name} × {item.quantity} — {(item.price * item.quantity).toFixed(2)} €</li>
                  ))}
                </ul>
                {order.note && <p className="order-note-text">{order.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
