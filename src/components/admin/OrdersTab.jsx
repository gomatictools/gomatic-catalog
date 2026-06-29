import { Package } from 'lucide-react'

export function OrdersTab({
  allOrders,
  filteredOrders,
  orderEdits, setOrderEdits,
  orderFilterUser, setOrderFilterUser,
  orderFilterStatus, setOrderFilterStatus,
  orderFilterPayment, setOrderFilterPayment,
  orderFilterDateFrom, setOrderFilterDateFrom,
  orderFilterDateTo, setOrderFilterDateTo,
  getOrderField, setOrderEdit,
  saveOrder, deleteOrder,
  loadAllOrders,
}) {
  return (
    <div className="admin-section">
      <div className="orders-tab-header">
        <h3>Нарачки</h3>
        <button type="button" className="btn-sm" onClick={loadAllOrders}>Освежи</button>
      </div>

      <div className="orders-filters">
        <input
          type="text"
          className="orders-filter-search"
          placeholder="Корисник или компанија…"
          value={orderFilterUser}
          onChange={e => setOrderFilterUser(e.target.value)}
        />
        <select className="orders-filter-select" value={orderFilterStatus} onChange={e => setOrderFilterStatus(e.target.value)}>
          <option value="all">Сите статуси</option>
          <option value="pending">Во чекање</option>
          <option value="ready">Спремено</option>
          <option value="delivered">Испорачано</option>
        </select>
        <select className="orders-filter-select" value={orderFilterPayment} onChange={e => setOrderFilterPayment(e.target.value)}>
          <option value="all">Сите плаќања</option>
          <option value="unpaid">Не е наплатено</option>
          <option value="paid">Наплатено</option>
        </select>
        <div className="orders-filter-dates">
          <input type="date" className="orders-filter-date" value={orderFilterDateFrom} onChange={e => setOrderFilterDateFrom(e.target.value)} title="Од датум" />
          <span className="orders-filter-date-sep">–</span>
          <input type="date" className="orders-filter-date" value={orderFilterDateTo} onChange={e => setOrderFilterDateTo(e.target.value)} title="До датум" />
        </div>
        {(orderFilterUser || orderFilterStatus !== 'all' || orderFilterPayment !== 'all' || orderFilterDateFrom || orderFilterDateTo) && (
          <button type="button" className="orders-filter-clear" onClick={() => {
            setOrderFilterUser(''); setOrderFilterStatus('all'); setOrderFilterPayment('all')
            setOrderFilterDateFrom(''); setOrderFilterDateTo('')
          }}>✕</button>
        )}
        <span className="orders-filter-count">{filteredOrders.length} / {allOrders.length}</span>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="empty-state" style={{ border: 'none', padding: '32px 0' }}>
          <Package size={36} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
          <p>{allOrders.length === 0 ? 'Нема нарачки.' : 'Нема нарачки според избраните филтри.'}</p>
        </div>
      ) : (
        <div className="orders-list">
          {filteredOrders.map(order => {
            const deliveryStatus = getOrderField(order, 'status')
            const paymentStatus = getOrderField(order, 'payment_status')
            const isDirty = !!orderEdits[order.id]
            return (
              <div key={order.id} className="order-card">
                <div className="order-card-header">
                  <span className="order-id">#{order.id}</span>
                  <span className="order-client">
                    {order.company_name ? <strong>{order.company_name}</strong> : null}
                    {order.company_name && order.user_name ? ' · ' : null}
                    {order.user_name}
                  </span>
                  <span className="order-date">{new Date(order.created_at).toLocaleDateString()}</span>
                  <strong className="order-total">{order.total.toFixed(2)} €</strong>
                </div>

                <ul className="order-items-list">
                  {order.items.map(item => (
                    <li key={item.id}>{item.name} × {item.quantity} — {(item.price * item.quantity).toFixed(2)} €</li>
                  ))}
                </ul>
                {order.note && <p className="order-note-text">{order.note}</p>}

                <div className="order-controls">
                  <div className="order-selects">
                    <select
                      className={`order-select order-select--delivery order-select--${deliveryStatus}`}
                      value={deliveryStatus}
                      onChange={e => setOrderEdit(order.id, 'status', e.target.value)}
                    >
                      <option value="pending">Во чекање</option>
                      <option value="ready">Спремено</option>
                      <option value="delivered">Испорачано</option>
                    </select>
                    <select
                      className={`order-select order-select--payment order-select--${paymentStatus}`}
                      value={paymentStatus || 'unpaid'}
                      onChange={e => setOrderEdit(order.id, 'payment_status', e.target.value)}
                    >
                      <option value="unpaid">Не е наплатено</option>
                      <option value="paid">Наплатено</option>
                    </select>
                  </div>
                  <div className="order-actions">
                    {isDirty && <button type="button" className="btn-order-save" onClick={() => saveOrder(order.id)}>Зачувај</button>}
                    {isDirty && <button type="button" className="btn-order-cancel" onClick={() => setOrderEdits(prev => { const n = { ...prev }; delete n[order.id]; return n })}>Откажи</button>}
                    <button type="button" className="btn-order-delete" onClick={() => deleteOrder(order.id)}>Избриши</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
