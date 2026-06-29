import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Package, Plus, ShoppingCart, X } from 'lucide-react'
import { StockBadge } from '../StockBadge'

export function ProductDetailModal({
  selectedProduct, setSelectedProduct,
  language,
  locale,
  isAdmin,
  isInStock,
  getCategoryChain,
  addToCart,
}) {
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [modalQty, setModalQty] = useState(1)

  useEffect(() => {
    setCarouselIdx(0)
    setModalQty(1)
  }, [selectedProduct?.id])

  if (!selectedProduct) return null

  const imgs = selectedProduct.images?.length
    ? selectedProduct.images
    : [{ id: 0, url: selectedProduct.image_url || null }]
  const hasMany = imgs.length > 1
  const src = imgs[carouselIdx]?.url ?? null

  return (
    <div className="product-modal-overlay" onMouseDown={() => setSelectedProduct(null)}>
      <div className="product-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={() => setSelectedProduct(null)}><X size={14} /></button>

        {/* Image carousel */}
        <div className="modal-image modal-carousel">
          {hasMany && (
            <button className="carousel-btn carousel-btn--prev"
              onClick={e => { e.stopPropagation(); setCarouselIdx(i => (i - 1 + imgs.length) % imgs.length) }}>
              <ChevronLeft size={18} />
            </button>
          )}
          {src
            ? <img src={src} alt={selectedProduct.name[language]} />
            : <div className="product-image__no-img"><Package size={48} strokeWidth={1} /></div>
          }
          {hasMany && (
            <button className="carousel-btn carousel-btn--next"
              onClick={e => { e.stopPropagation(); setCarouselIdx(i => (i + 1) % imgs.length) }}>
              <ChevronRight size={18} />
            </button>
          )}
          {hasMany && (
            <div className="carousel-dots">
              {imgs.map((_, i) => (
                <button key={i}
                  className={`carousel-dot${i === carouselIdx ? ' carousel-dot--active' : ''}`}
                  onClick={e => { e.stopPropagation(); setCarouselIdx(i) }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="modal-details">
          {/* Category breadcrumb */}
          <div className="product-category">
            {getCategoryChain(selectedProduct.category).map((name, i) => (
              <span key={i}>{name}</span>
            ))}
          </div>

          {/* Name */}
          <h2>{selectedProduct.name[language]}</h2>

          {/* Description */}
          {selectedProduct.description[language] && (
            <p>{selectedProduct.description[language]}</p>
          )}

          {/* Specs table */}
          <div className="modal-specs">
            <div className="modal-specs__row">
              <div className="modal-specs__label">Шифра (SKU)</div>
              <div className="modal-specs__value modal-specs__value--mono">{selectedProduct.sku}</div>
            </div>
            <div className="modal-specs__row">
              <div className="modal-specs__label">Категорија</div>
              <div className="modal-specs__value">{getCategoryChain(selectedProduct.category).join(' › ')}</div>
            </div>
            {isAdmin && (
              <div className="modal-specs__row">
                <div className="modal-specs__label">На залиха</div>
                <div className="modal-specs__value">
                  <StockBadge product={selectedProduct} />
                </div>
              </div>
            )}
          </div>

          {/* Price + stock */}
          <div className="modal-stock-row">
            <div>
              <div className="modal-price">
                {selectedProduct.price.toFixed(2)} €
                <span className="modal-price__vat">без ДДВ</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          {!isAdmin ? (
            <div className="modal-cta-row">
              {isInStock(selectedProduct) && (
                <div className="card-qty card-qty--sm card-qty--md">
                  <button type="button" className="card-qty__btn"
                    onClick={() => setModalQty(q => Math.max(1, q - 1))}>
                    <Minus size={12} />
                  </button>
                  <input type="number" min="1" value={modalQty}
                    onChange={e => setModalQty(Math.max(1, Number(e.target.value) || 1))}
                  />
                  <button type="button" className="card-qty__btn"
                    onClick={() => setModalQty(q => q + 1)}>
                    <Plus size={12} />
                  </button>
                </div>
              )}
              <button
                type="button"
                disabled={!isInStock(selectedProduct)}
                onClick={() => { addToCart(selectedProduct.id, modalQty); setSelectedProduct(null) }}
              >
                <ShoppingCart size={16} />
                {locale.addToCart}
              </button>
            </div>
          ) : (
            <button type="button" disabled>
              <ShoppingCart size={16} />
              {locale.addToCart}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
