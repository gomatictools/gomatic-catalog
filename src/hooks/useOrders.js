import { useEffect, useMemo, useState } from 'react'
import { API_BASE } from '../lib/utils'

export function useOrders({ setError, authToken, authUser, isAdmin }) {
  const [allOrders, setAllOrders] = useState([])
  const [myOrders, setMyOrders] = useState([])
  const [myOrdersOpen, setMyOrdersOpen] = useState(false)
  const [orderEdits, setOrderEdits] = useState({})
  const [orderFilterDateFrom, setOrderFilterDateFrom] = useState('')
  const [orderFilterDateTo, setOrderFilterDateTo] = useState('')
  const [orderFilterStatus, setOrderFilterStatus] = useState('all')
  const [orderFilterPayment, setOrderFilterPayment] = useState('all')
  const [orderFilterUser, setOrderFilterUser] = useState('')

  // Auto-load all orders when admin is authenticated
  useEffect(() => {
    if (isAdmin && authToken) {
      fetch(`${API_BASE}/api/orders`, { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : [])
        .then(data => setAllOrders(data))
        .catch(() => {})
    }
  }, [isAdmin, authToken])

  const loadMyOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders/my`, { headers: { Authorization: `Bearer ${authToken}` } })
      if (res.ok) setMyOrders(await res.json())
    } catch { /* silent */ }
  }

  const loadAllOrders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/orders`, { headers: { Authorization: `Bearer ${authToken}` } })
      if (res.ok) { setAllOrders(await res.json()); setOrderEdits({}) }
    } catch { /* silent */ }
  }

  const saveOrder = async (orderId) => {
    const edits = orderEdits[orderId]
    if (!edits) return
    try {
      await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(edits),
      })
      setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...edits } : o))
      setOrderEdits(prev => { const n = { ...prev }; delete n[orderId]; return n })
    } catch { setError('Не може да се зачува нарачката.') }
  }

  const deleteOrder = async (orderId) => {
    if (!window.confirm(`Сигурно сакате да ја избришете нарачка #${orderId}?`)) return
    try {
      await fetch(`${API_BASE}/api/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      setAllOrders(prev => prev.filter(o => o.id !== orderId))
    } catch { setError('Не може да се избрише нарачката.') }
  }

  const getOrderField = (order, field) =>
    orderEdits[order.id]?.[field] !== undefined ? orderEdits[order.id][field] : order[field]

  const setOrderEdit = (orderId, field, value) =>
    setOrderEdits(prev => ({ ...prev, [orderId]: { ...prev[orderId], [field]: value } }))

  const filteredOrders = useMemo(() => {
    return allOrders.filter(order => {
      if (orderFilterStatus !== 'all' && order.status !== orderFilterStatus) return false
      if (orderFilterPayment !== 'all' && (order.payment_status || 'unpaid') !== orderFilterPayment) return false
      if (orderFilterUser) {
        const q = orderFilterUser.toLowerCase()
        const inCompany = (order.company_name || '').toLowerCase().includes(q)
        const inName = (order.user_name || '').toLowerCase().includes(q)
        if (!inCompany && !inName) return false
      }
      if (orderFilterDateFrom) {
        const from = new Date(orderFilterDateFrom)
        if (new Date(order.created_at) < from) return false
      }
      if (orderFilterDateTo) {
        const to = new Date(orderFilterDateTo)
        to.setHours(23, 59, 59, 999)
        if (new Date(order.created_at) > to) return false
      }
      return true
    })
  }, [allOrders, orderFilterStatus, orderFilterPayment, orderFilterUser, orderFilterDateFrom, orderFilterDateTo])

  const orderedProductIds = useMemo(() => {
    const ids = new Set()
    allOrders.forEach(order => order.items?.forEach(item => ids.add(item.product_id)))
    return ids
  }, [allOrders])

  return {
    allOrders, setAllOrders,
    myOrders,
    myOrdersOpen, setMyOrdersOpen,
    orderEdits, setOrderEdits,
    orderFilterDateFrom, setOrderFilterDateFrom,
    orderFilterDateTo, setOrderFilterDateTo,
    orderFilterStatus, setOrderFilterStatus,
    orderFilterPayment, setOrderFilterPayment,
    orderFilterUser, setOrderFilterUser,
    filteredOrders,
    orderedProductIds,
    loadMyOrders,
    loadAllOrders,
    saveOrder,
    deleteOrder,
    getOrderField,
    setOrderEdit,
  }
}
