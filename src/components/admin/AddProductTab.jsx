import { Minus, Plus, X } from 'lucide-react'
import { availableLanguages } from '../../lib/utils'

export function AddProductTab({
  newProduct, setNewProduct,
  categoriesFlat,
  handleNewProductChange,
  addProduct,
}) {
  return (
    <div className="admin-section">
      <h3>Додај нов производ</h3>
      <form onSubmit={addProduct} className="admin-form">
        <div className="add-product-4col">

          {/* Col 1: МК + EN */}
          <div className="add-product-col">
            <div className="admin-group">
              <label>Назив (Македонски)</label>
              <input value={newProduct.name.mk} onChange={e => handleNewProductChange('name.mk', e.target.value)} />
              <label>Опис (Македонски)</label>
              <textarea value={newProduct.description.mk} onChange={e => handleNewProductChange('description.mk', e.target.value)} />
            </div>
            <div className="admin-group">
              <label>Назив (English)</label>
              <input value={newProduct.name.en} onChange={e => handleNewProductChange('name.en', e.target.value)} />
              <label>Опис (English)</label>
              <textarea value={newProduct.description.en} onChange={e => handleNewProductChange('description.en', e.target.value)} />
            </div>
          </div>

          {/* Col 2: СР + АЛ */}
          <div className="add-product-col">
            <div className="admin-group">
              <label>Назив (Српски)</label>
              <input value={newProduct.name.sr} onChange={e => handleNewProductChange('name.sr', e.target.value)} />
              <label>Опис (Српски)</label>
              <textarea value={newProduct.description.sr} onChange={e => handleNewProductChange('description.sr', e.target.value)} />
            </div>
            <div className="admin-group">
              <label>Назив (Албански)</label>
              <input value={newProduct.name.sq} onChange={e => handleNewProductChange('name.sq', e.target.value)} />
              <label>Опис (Албански)</label>
              <textarea value={newProduct.description.sq} onChange={e => handleNewProductChange('description.sq', e.target.value)} />
            </div>
          </div>

          {/* Col 3: Категорија + Цена + SKU + Слики */}
          <div className="add-product-col">
            <div className="admin-group">
              <label>Категорија</label>
              <select value={newProduct.category} onChange={e => handleNewProductChange('category', e.target.value)}>
                {categoriesFlat.map(cat => (
                  <option key={cat.id} value={cat.id}>{'   '.repeat(cat.depth)}{cat.depth > 0 ? '└ ' : ''}{cat.label}</option>
                ))}
              </select>
              <label>Цена</label>
              <input value={newProduct.price} onChange={e => handleNewProductChange('price', e.target.value)} />
              <label>Шифра</label>
              <input value={newProduct.sku} onChange={e => handleNewProductChange('sku', e.target.value)} />
              <label>Слики (до 3)</label>
              <div className="img-gallery-slots">
                {[0, 1, 2].map(i => (
                  <div key={i} className={`img-slot${newProduct.images[i] ? ' img-slot--filled' : ''}`}>
                    {newProduct.images[i] ? (
                      <>
                        <img src={newProduct.images[i]} alt={`Слика ${i + 1}`} />
                        {i === 0 && <span className="img-slot__badge">Главна</span>}
                        <button type="button" className="img-slot__remove"
                          onClick={() => setNewProduct(prev => {
                            const imgs = [...prev.images]; imgs[i] = ''; return { ...prev, images: imgs }
                          })}>
                          <X size={11} />
                        </button>
                      </>
                    ) : (
                      <label className="img-slot__upload">
                        <Plus size={18} />
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0]; if (!file) return
                            const reader = new FileReader()
                            reader.onload = ev => setNewProduct(prev => {
                              const imgs = [...prev.images]; imgs[i] = ev.target.result; return { ...prev, images: imgs }
                            })
                            reader.readAsDataURL(file)
                          }} />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Col 4: Stock fields */}
          <div className="add-product-col">
            <div className="admin-group">
              <label>Датум</label>
              <input
                type="date"
                value={newProduct.stock_date}
                onChange={e => setNewProduct(p => ({ ...p, stock_date: e.target.value }))}
              />
              <div className="add-product-stock-row">
                <div>
                  <label>Влез</label>
                  <div className="admin-stock-stepper">
                    <button type="button" className="admin-stock-stepper__btn"
                      onClick={() => setNewProduct(p => ({ ...p, stock: String(Math.max(0, Number(p.stock) - 1)) }))}>
                      <Minus size={13} />
                    </button>
                    <input type="number" min="0" value={newProduct.stock}
                      onChange={e => setNewProduct(p => ({ ...p, stock: e.target.value }))} />
                    <button type="button" className="admin-stock-stepper__btn"
                      onClick={() => setNewProduct(p => ({ ...p, stock: String(Number(p.stock) + 1) }))}>
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <div>
                  <label>Критична залиха</label>
                  <div className="admin-stock-stepper">
                    <button type="button" className="admin-stock-stepper__btn"
                      onClick={() => setNewProduct(p => ({ ...p, critical_stock: String(Math.max(0, Number(p.critical_stock) - 1)) }))}>
                      <Minus size={13} />
                    </button>
                    <input type="number" min="0" value={newProduct.critical_stock}
                      onChange={e => setNewProduct(p => ({ ...p, critical_stock: e.target.value }))} />
                    <button type="button" className="admin-stock-stepper__btn"
                      onClick={() => setNewProduct(p => ({ ...p, critical_stock: String(Number(p.critical_stock) + 1) }))}>
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              </div>
              <label>Набавувач</label>
              <input
                type="text"
                value={newProduct.stock_party}
                onChange={e => setNewProduct(p => ({ ...p, stock_party: e.target.value }))}
                placeholder="Назив на набавувач..."
              />
              <label>Забелешка <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(незадолжително)</span></label>
              <textarea
                value={newProduct.stock_note}
                onChange={e => setNewProduct(p => ({ ...p, stock_note: e.target.value }))}
                placeholder="Дополнителни информации..."
                rows={2}
              />
            </div>
          </div>

        </div>
        <div className="admin-actions admin-actions--right">
          <button type="submit">Додај производ</button>
        </div>
      </form>
    </div>
  )
}
