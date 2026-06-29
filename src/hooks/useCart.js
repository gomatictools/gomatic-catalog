import { useRef, useState } from 'react'
import { API_BASE } from '../lib/utils'

export function useCart({ authUser, authToken, productList, language, loadProducts, setError, openAuthModal }) {
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [cartAnimKey, setCartAnimKey] = useState(0)
  const [flashProductId, setFlashProductId] = useState(null)
  const flashTimerRef = useRef(null)
  const [cardQuantities, setCardQuantities] = useState({})
  const [orderNote, setOrderNote] = useState('')
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [orderResult, setOrderResult] = useState(null)

  const cartItems = cart
    .map(entry => {
      const product = productList.find(p => p.id === entry.productId)
      return product ? { ...entry, product, subtotal: product.price * entry.quantity } : null
    })
    .filter(Boolean)

  const totalPrice = cartItems.reduce((sum, item) => sum + item.subtotal, 0)
  const totalCartQty = cart.reduce((s, e) => s + e.quantity, 0)

  const playAddSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const note = (freq, start, dur) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.18, start + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
        osc.start(start)
        osc.stop(start + dur)
      }
      note(880,    ctx.currentTime,        0.14)
      note(1318.5, ctx.currentTime + 0.11, 0.18)
    } catch { /* AudioContext not supported */ }
  }

  const addToCart = (productId, qty = 1) => {
    if (!authUser) { openAuthModal('login'); return }
    setCart(cur => {
      const item = cur.find(e => e.productId === productId)
      if (item) return cur.map(e => e.productId === productId ? { ...e, quantity: e.quantity + qty } : e)
      return [...cur, { productId, quantity: qty }]
    })
    playAddSound()
    setCartAnimKey(k => k + 1)
    setFlashProductId(productId)
    clearTimeout(flashTimerRef.current)
    flashTimerRef.current = setTimeout(() => setFlashProductId(null), 650)
  }

  const removeFromCart = (productId) => setCart(cur => cur.filter(e => e.productId !== productId))

  const updateQuantity = (productId, quantity) =>
    setCart(cur =>
      cur.map(e => e.productId === productId ? { ...e, quantity: Math.max(1, quantity) } : e)
        .filter(e => e.quantity > 0),
    )

  const placeOrder = async () => {
    if (!authUser) { openAuthModal('login'); return }
    if (!cartItems.length) return
    try {
      const items = cartItems.map(item => ({
        product_id: item.product.id,
        sku: item.product.sku,
        name: item.product.name[language],
        price: item.product.price,
        quantity: item.quantity,
      }))
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ items, note: orderNote, total: totalPrice }),
      })
      if (!res.ok) { const b = await res.json(); setError(b.error || 'Грешка'); return }
      const result = await res.json()
      setCart([])
      setOrderNote('')
      setOrderResult({ id: result.id, date: new Date().toLocaleDateString() })
      setOrderSuccess(true)
      setTimeout(() => { setOrderSuccess(false); setOrderResult(null) }, 6000)
      loadProducts()
    } catch {
      setError('Не може да се испрати нарачката.')
    }
  }

  return {
    cart, setCart,
    cartOpen, setCartOpen,
    cartAnimKey,
    flashProductId,
    flashTimerRef,
    cardQuantities, setCardQuantities,
    orderNote, setOrderNote,
    orderSuccess,
    orderResult,
    cartItems,
    totalPrice,
    totalCartQty,
    addToCart,
    removeFromCart,
    updateQuantity,
    placeOrder,
    playAddSound,
  }
}
