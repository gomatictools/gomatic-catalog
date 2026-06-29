import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

export function StockBadge({ product, critical }) {
  const isInStock = (product.stock ?? 0) > 0
  if (isInStock) {
    return (
      <span className={`stock-badge ${critical ? 'stock-badge--critical' : 'stock-badge--in'}`}>
        {critical ? <AlertTriangle size={9} strokeWidth={3} /> : <CheckCircle2 size={9} strokeWidth={3} />}
        {product.stock} ед.
      </span>
    )
  }
  return (
    <span className="stock-badge stock-badge--out">
      <XCircle size={9} strokeWidth={3} />
      Нема
    </span>
  )
}
