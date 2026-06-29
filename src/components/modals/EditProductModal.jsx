import { Minus, Plus, X } from 'lucide-react'
import { availableLanguages } from '../../lib/utils'

export function EditProductModal({
  editModalOpen, setEditModalOpen,
  editingProductId, setEditingProductId,
  editProduct, setEditProduct,
  categoriesFlat,
  handleEditProductChange,
  saveEditProduct,
  deleteEditImage,
  setPrimaryEditImage,
  handleImgDragStart,
  handleImgDrop,
}) {
  if (!editModalOpen || !editProduct) return null

  const onClose = () => {
    setEditModalOpen(false)
    setEditingProductId(null)
    setEditProduct(null)
  }

  return (
    <div className="product-modal-overlay" onMouseDown={onClose}>
      <div className="edit-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={14} />
        </button>

        <div className="edit-modal__header">
          <h2>Уреди производ</h2>
          <span className="edit-modal__sku-badge">{editProduct.sku}</span>
        </div>

        <form onSubmit={saveEditProduct} className="edit-modal__body">

          {/* Left: image + key fields */}
          <div className="edit-modal__left">

            {/* Image gallery */}
            <div className="edit-modal__field">
              <label>Слики (до 3)</label>
              <div className="img-gallery-slots">
                {(editProduct.images || []).map((img, i) => (
                  <div
                    key={img.id}
                    className="img-slot img-slot--filled img-slot--draggable"
                    draggable
                    onDragStart={e => handleImgDragStart(e, i)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => handleImgDrop(e, i)}
                  >
                    <img src={img.url} alt={`Слика ${i + 1}`} />
                    {img.is_primary ? <span className="img-slot__badge">Главна</span> : null}
                    <button
                      type="button"
                      className={`img-slot__primary-btn${img.is_primary ? ' active' : ''}`}
                      title="Постави за главна"
                      onClick={() => setPrimaryEditImage(img.id)}
                    >★</button>
                    <button type="button" className="img-slot__remove" onClick={() => deleteEditImage(img.id)}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {(editProduct.pendingImages || []).map((imgData, i) => (
                  <div key={`p${i}`} className="img-slot img-slot--filled">
                    <img src={imgData} alt="нова" />
                    <button type="button" className="img-slot__remove"
                      onClick={() => setEditProduct(prev => ({ ...prev, pendingImages: prev.pendingImages.filter((_, j) => j !== i) }))}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {((editProduct.images?.length || 0) + (editProduct.pendingImages?.length || 0)) < 3 && (
                  <div className="img-slot">
                    <label className="img-slot__upload">
                      <Plus size={18} />
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0]; if (!file) return
                          const reader = new FileReader()
                          reader.onload = ev => setEditProduct(prev => ({
                            ...prev, pendingImages: [...(prev.pendingImages || []), ev.target.result]
                          }))
                          reader.readAsDataURL(file)
                        }} />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* SKU */}
            <div className="edit-modal__field">
              <label>Шифра (SKU)</label>
              <input
                value={editProduct.sku}
                onChange={e => handleEditProductChange('sku', e.target.value)}
                placeholder="001.234/56"
              />
            </div>

            {/* Category */}
            <div className="edit-modal__field">
              <label>Категорија</label>
              <select value={editProduct.category} onChange={e => handleEditProductChange('category', e.target.value)}>
                {categoriesFlat.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {'  '.repeat(cat.depth)}{cat.depth > 0 ? '└ ' : ''}{cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Price */}
            <div className="edit-modal__field">
              <label>Цена (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editProduct.price}
                onChange={e => handleEditProductChange('price', e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Stock */}
            <div className="edit-modal__field">
              <label>Залиха (количина)</label>
              <div className="edit-stock-stepper">
                <button
                  type="button"
                  className="edit-stock-stepper__btn"
                  onClick={() => setEditProduct(p => ({ ...p, stock: String(Math.max(0, Number(p.stock) - 1)) }))}
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="0"
                  value={editProduct.stock}
                  onChange={e => setEditProduct(p => ({ ...p, stock: e.target.value }))}
                />
                <button
                  type="button"
                  className="edit-stock-stepper__btn"
                  onClick={() => setEditProduct(p => ({ ...p, stock: String(Number(p.stock) + 1) }))}
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="edit-stock-stepper__hint">
                {Number(editProduct.stock) === 0
                  ? '⊘ Ќе се прикаже „Нема залиха"'
                  : `✓ Достапно — ${editProduct.stock} ед.`}
              </span>
            </div>

            {/* Critical Stock */}
            <div className="edit-modal__field">
              <label>Критична залиха</label>
              <div className="edit-stock-stepper">
                <button
                  type="button"
                  className="edit-stock-stepper__btn"
                  onClick={() => setEditProduct(p => ({ ...p, critical_stock: String(Math.max(0, Number(p.critical_stock ?? 0) - 1)) }))}
                >
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="0"
                  value={editProduct.critical_stock ?? 0}
                  onChange={e => setEditProduct(p => ({ ...p, critical_stock: e.target.value }))}
                />
                <button
                  type="button"
                  className="edit-stock-stepper__btn"
                  onClick={() => setEditProduct(p => ({ ...p, critical_stock: String(Number(p.critical_stock ?? 0) + 1) }))}
                >
                  <Plus size={14} />
                </button>
              </div>
              <span className="edit-stock-stepper__hint edit-stock-stepper__hint--warn">
                {Number(editProduct.critical_stock ?? 0) === 0
                  ? '— Без предупредување'
                  : `⚠ Предупредување при ≤ ${editProduct.critical_stock} ед.`}
              </span>
            </div>
          </div>

          {/* Right: name per language */}
          <div className="edit-modal__right">
            <p className="edit-modal__section-label">Назив на производот</p>

            {availableLanguages.map(lang => (
              <div key={lang.code} className="edit-modal__field">
                <label>
                  {lang.code === 'mk' ? '🇲🇰' : lang.code === 'sr' ? '🇷🇸' : lang.code === 'sq' ? '🇦🇱' : '🇬🇧'}{' '}
                  {lang.label}
                </label>
                <input
                  value={editProduct.name[lang.code]}
                  onChange={e => handleEditProductChange(`name.${lang.code}`, e.target.value)}
                  placeholder={`Назив на ${lang.label}...`}
                />
              </div>
            ))}

            <p className="edit-modal__section-label" style={{ marginTop: 16 }}>Опис (незадолжително)</p>

            {availableLanguages.map(lang => (
              <div key={lang.code} className="edit-modal__field">
                <label>
                  {lang.code === 'mk' ? '🇲🇰' : lang.code === 'sr' ? '🇷🇸' : lang.code === 'sq' ? '🇦🇱' : '🇬🇧'}{' '}
                  {lang.label}
                </label>
                <textarea
                  rows={2}
                  value={editProduct.description[lang.code]}
                  onChange={e => handleEditProductChange(`description.${lang.code}`, e.target.value)}
                  placeholder={`Опис на ${lang.label}...`}
                />
              </div>
            ))}
          </div>

          {/* Footer actions */}
          <div className="edit-modal__footer">
            <button type="submit" className="btn-save">Зачувај промени</button>
            <button type="button" className="btn-cancel" onClick={onClose}>
              Откажи
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
