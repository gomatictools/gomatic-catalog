import { ArrowDownCircle, ArrowUpCircle, Minus, Plus, X } from 'lucide-react'

export function StockModal({
  stockModal, setStockModal,
  stockForm, setStockForm,
  language,
  submitStockMovement,
}) {
  if (!stockModal) return null
  return (
    <div className="product-modal-overlay" onMouseDown={() => setStockModal(null)}>
      <div className="stock-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setStockModal(null)}><X size={14} /></button>

        <div className={`stock-modal__header stock-modal__header--${stockModal.type}`}>
          {stockModal.type === 'in'
            ? <><ArrowDownCircle size={20} /> Влез на залиха</>
            : <><ArrowUpCircle size={20} /> Излез на залиха</>}
        </div>

        <div className="stock-modal__product">
          <span className="product-sku">{stockModal.product.sku}</span>
          <strong>{stockModal.product.name[language]}</strong>
          <span className="stock-modal__current">
            Тековна залиха: <strong>{stockModal.product.stock} ед.</strong>
          </span>
        </div>

        <form onSubmit={submitStockMovement} className="stock-modal__form">
          <div className="stock-modal__field">
            <label>Датум</label>
            <input
              type="date"
              value={stockForm.date}
              onChange={e => setStockForm(p => ({ ...p, date: e.target.value }))}
              required
            />
          </div>

          <div className="stock-modal__field">
            <label>Количина</label>
            <div className="edit-stock-stepper">
              <button type="button" className="edit-stock-stepper__btn"
                onClick={() => setStockForm(p => ({ ...p, quantity: String(Math.max(1, Number(p.quantity) - 1)) }))}>
                <Minus size={14} />
              </button>
              <input
                type="number"
                min="1"
                value={stockForm.quantity}
                onChange={e => setStockForm(p => ({ ...p, quantity: e.target.value }))}
                required
              />
              <button type="button" className="edit-stock-stepper__btn"
                onClick={() => setStockForm(p => ({ ...p, quantity: String(Number(p.quantity) + 1) }))}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="stock-modal__field">
            <label>{stockModal.type === 'in' ? 'Набавувач' : 'Купувач / Примач'}</label>
            <input
              type="text"
              value={stockForm.party}
              onChange={e => setStockForm(p => ({ ...p, party: e.target.value }))}
              placeholder={stockModal.type === 'in' ? 'Назив на набавувач...' : 'Назив на купувач / примач...'}
            />
          </div>

          <div className="stock-modal__field">
            <label>Забелешка <span style={{ fontWeight: 400, textTransform: 'none' }}>(незадолжително)</span></label>
            <textarea
              rows={2}
              value={stockForm.note}
              onChange={e => setStockForm(p => ({ ...p, note: e.target.value }))}
              placeholder="Дополнителни информации..."
            />
          </div>

          <div className="stock-modal__actions">
            <button type="submit" className={stockModal.type === 'in' ? 'btn-stock-submit-in' : 'btn-stock-submit-out'}>
              {stockModal.type === 'in' ? <><ArrowDownCircle size={14} /> Внеси влез</> : <><ArrowUpCircle size={14} /> Внеси излез</>}
            </button>
            <button type="button" className="btn-cancel" onClick={() => setStockModal(null)}>Откажи</button>
          </div>
        </form>
      </div>
    </div>
  )
}
