import {
  AlertTriangle, ArrowDownCircle, ArrowUpCircle, History,
  Minus, Package, Plus, ShoppingCart, XCircle,
} from 'lucide-react'
import { StockBadge } from './StockBadge'

export function ProductCard({
  product,
  isAdmin,
  adminOpen,
  isCritical,
  isOrdered,
  dropProductTarget,
  flashProductId,
  cardQty,
  locale,
  language,
  getCategoryChain,
  isInStock,
  onOpenDetail,
  onAddToCart,
  onSetCardQty,
  onOpenStockModal,
  onOpenStockHistory,
  onStartEdit,
  onDelete,
  onToggleManualOrdered,
  onProdDragStart,
  onProdDragOver,
  onProdDrop,
  onProdDragEnd,
}) {
  return (
    <article
      className={`product-card${isAdmin && adminOpen ? ' admin-draggable' : ''}${dropProductTarget.id === product.id ? ` drop-prod-${dropProductTarget.position}` : ''}${isCritical ? ' product-card--critical' : ''}${isOrdered ? ' product-card--ordered' : ''}`}
      draggable={!!(isAdmin && adminOpen)}
      onDragStart={isAdmin && adminOpen ? e => onProdDragStart(e, product.id) : undefined}
      onDragOver={isAdmin && adminOpen ? e => onProdDragOver(e, product.id) : undefined}
      onDrop={isAdmin && adminOpen ? e => onProdDrop(e, product.id) : undefined}
      onDragEnd={isAdmin && adminOpen ? onProdDragEnd : undefined}
    >
      {/* Image */}
      <div className="product-image product-image--clickable" onClick={() => { if (!isAdmin) onOpenDetail(product) }}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name[language]} />
          : <div className="product-image__no-img"><Package size={32} strokeWidth={1} /></div>
        }
        {!isInStock(product) && (
          <div className="product-image__out-of-stock">Нема залиха</div>
        )}
        {isOrdered && (
          <div className="product-image__ordered-badge">Нарачано</div>
        )}
        {isCritical && (
          <div className="product-image__critical-badge">
            <AlertTriangle size={10} /> Критична залиха
          </div>
        )}
      </div>

      {/* Body */}
      <div className="product-details">
        {/* Category breadcrumb */}
        <div className="product-category">
          {(() => {
            const chain = getCategoryChain(product.category)
            const padded = chain.length >= 2 ? chain : [...chain, ...Array(2 - chain.length).fill('')]
            return padded.map((name, i) => (
              <span key={i} className={name === '' ? 'cat-placeholder' : ''}>{name || ' '}</span>
            ))
          })()}
        </div>

        {/* Name */}
        <h2 className="product-name--clickable" onClick={() => { if (!isAdmin) onOpenDetail(product) }}>
          {product.name[language]}
        </h2>

        {/* SKU + stock */}
        <div className="product-meta-row">
          <span className="product-sku">{product.sku}</span>
          {isAdmin && <StockBadge product={product} critical={isCritical} />}
        </div>

        {/* Price + compact qty stepper inline */}
        <div className="product-meta">
          <strong className="product-price">{product.price.toFixed(2)} €</strong>
          {!isAdmin && isInStock(product) && (
            <div className="card-qty card-qty--sm">
              <button
                type="button"
                className="card-qty__btn"
                onClick={() => onSetCardQty(product.id, Math.max(1, cardQty - 1))}
              >
                <Minus size={10} />
              </button>
              <input
                type="number"
                min="1"
                value={cardQty}
                onChange={e => onSetCardQty(product.id, Math.max(1, Number(e.target.value) || 1))}
              />
              <button
                type="button"
                className="card-qty__btn"
                onClick={() => onSetCardQty(product.id, cardQty + 1)}
              >
                <Plus size={10} />
              </button>
            </div>
          )}
        </div>

        {/* Admin: Влез / Излез | User: Додади во кошничка */}
        {isAdmin ? (
          <div className="admin-stock-btns">
            <button type="button" className="btn-stock-in" onClick={() => onOpenStockModal('in', product)}>
              <ArrowDownCircle size={13} /> Влез
            </button>
            <button type="button" className="btn-stock-out" onClick={() => onOpenStockModal('out', product)} disabled={!isInStock(product)}>
              <ArrowUpCircle size={13} /> Излез
            </button>
            <button type="button" className="btn-stock-history" onClick={() => onOpenStockHistory(product)} title="Историја на движења">
              <History size={13} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={flashProductId === product.id ? 'btn-add--flash' : ''}
            onClick={() => {
              onAddToCart(product.id, cardQty)
              if (isInStock(product)) onSetCardQty(product.id, 1)
            }}
            disabled={!isInStock(product)}
          >
            {isInStock(product) ? (
              <><ShoppingCart size={13} />{locale.addToCart}</>
            ) : (
              <><XCircle size={13} />Нема на залиха</>
            )}
          </button>
        )}

        {/* Admin actions */}
        {adminOpen && isAdmin && (
          <div className="product-admin-actions">
            <button type="button" className="btn-edit-sm" onClick={() => onStartEdit(product)}>Уреди</button>
            <button type="button" className="btn-delete-sm" onClick={() => {
              if (window.confirm(`Сигурно сакате да го избришете „${product.name.mk || product.sku}"?`)) onDelete(product.id)
            }}>Избриши</button>
            <button
              type="button"
              className={`btn-ordered-sm${isOrdered ? ' btn-ordered-sm--active' : ''}`}
              onClick={() => onToggleManualOrdered(product.id)}
            >
              {isOrdered ? 'Нарачано ✕' : 'Нарачано'}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}
