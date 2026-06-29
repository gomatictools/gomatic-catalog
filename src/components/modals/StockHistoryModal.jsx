import { ArrowDownCircle, ArrowUpCircle, History, Package, X } from 'lucide-react'

export function StockHistoryModal({
  stockHistory, setStockHistory,
  stockHistoryData,
  language,
}) {
  if (!stockHistory) return null
  return (
    <div className="product-modal-overlay" onMouseDown={() => setStockHistory(null)}>
      <div className="stock-history-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setStockHistory(null)}><X size={14} /></button>
        <div className="stock-history-modal__header">
          <History size={17} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{stockHistory.name[language]}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {stockHistory.sku} · Тековно: <strong>{stockHistory.stock} ед.</strong>
            </div>
          </div>
        </div>

        {stockHistoryData.length === 0 ? (
          <div className="empty-state" style={{ border: 'none', padding: '28px 0' }}>
            <Package size={32} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
            <p>Нема евиденција на движења.</p>
          </div>
        ) : (
          <div className="stock-history-list">
            {stockHistoryData.map(row => (
              <div key={row.id} className={`stock-history-row stock-history-row--${row.type}`}>
                <div className={`stock-history-type stock-history-type--${row.type}`}>
                  {row.type === 'in' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                  {row.type === 'in' ? 'Влез' : 'Излез'}
                </div>
                <div className="stock-history-qty">
                  {row.type === 'in' ? '+' : '−'}{row.quantity} ед.
                </div>
                <div className="stock-history-date">{row.movement_date}</div>
                <div className="stock-history-party">{row.party || '—'}</div>
                {row.note && <div className="stock-history-note">{row.note}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
