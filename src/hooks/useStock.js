import { useState } from 'react'
import { API_BASE } from '../lib/utils'

export function useStock({ setError, authToken, loadProducts }) {
  const [stockModal, setStockModal] = useState(null)
  const [stockForm, setStockForm] = useState({ quantity: '1', party: '', note: '', date: '' })
  const [stockHistory, setStockHistory] = useState(null)
  const [stockHistoryData, setStockHistoryData] = useState([])

  const openStockModal = (type, product) => {
    const today = new Date().toISOString().split('T')[0]
    setStockForm({ quantity: '1', party: '', note: '', date: today })
    setStockModal({ type, product })
  }

  const submitStockMovement = async (ev, pendingOrderProductIds, setFulfilledIds) => {
    ev.preventDefault()
    const { type, product } = stockModal
    try {
      const res = await fetch(`${API_BASE}/api/stock/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          product_id: product.id,
          quantity: Math.max(1, Number(stockForm.quantity) || 1),
          party: stockForm.party,
          note: stockForm.note,
          date: stockForm.date,
        }),
      })
      if (!res.ok) { const b = await res.json(); setError(b.error || 'Грешка'); return }
      if (type === 'in' && pendingOrderProductIds.has(product.id)) {
        setFulfilledIds(prev => new Set([...prev, product.id]))
      }
      await loadProducts()
      setStockModal(null)
    } catch {
      setError('Не може да се зачува движење на залиха.')
    }
  }

  const openStockHistory = async (product) => {
    setStockHistory(product)
    setStockHistoryData([])
    try {
      const res = await fetch(`${API_BASE}/api/stock/${product.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (res.ok) setStockHistoryData(await res.json())
    } catch { /* silent */ }
  }

  return {
    stockModal, setStockModal,
    stockForm, setStockForm,
    stockHistory, setStockHistory,
    stockHistoryData,
    openStockModal,
    submitStockMovement,
    openStockHistory,
  }
}
