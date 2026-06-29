import { useRef, useState } from 'react'
import { API_BASE } from '../lib/utils'

export function useProducts({ setError, authToken }) {
  const [productList, setProductList] = useState([])
  const [loading, setLoading] = useState(true)
  const [newProduct, setNewProduct] = useState({
    name: { mk: '', sr: '', sq: '', en: '' },
    description: { mk: '', sr: '', sq: '', en: '' },
    category: '',
    price: '',
    sku: '',
    images: ['', '', ''],
    stock: '0',
    critical_stock: '0',
    stock_date: new Date().toISOString().split('T')[0],
    stock_party: '',
    stock_note: '',
  })
  const [editingProductId, setEditingProductId] = useState(null)
  const [editProduct, setEditProduct] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const dragProductRef = useRef({ id: null, position: 'after' })
  const imgDragRef = useRef(null)
  const [dropProductTarget, setDropProductTarget] = useState({ id: null, position: null })
  const [adminStockFilter, setAdminStockFilter] = useState('all')
  const [fulfilledIds, setFulfilledIds] = useState(new Set())
  const [manualOrderedIds, setManualOrderedIds] = useState(new Set())

  const isInStock = (product) => (product.stock ?? 0) > 0

  const isCriticalStock = (product) => {
    const stock = product.stock ?? 0
    const critical = product.critical_stock ?? 0
    return stock > 0 && critical > 0 && stock <= critical
  }

  const loadProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/api/products`)
      if (!response.ok) throw new Error()
      setProductList(await response.json())
    } catch {
      setError('Не може да се вчитаат производите. Проверете дали backend серверот работи.')
    } finally {
      setLoading(false)
    }
  }

  const resetNewProduct = (categoryList) =>
    setNewProduct({
      name: { mk: '', sr: '', sq: '', en: '' },
      description: { mk: '', sr: '', sq: '', en: '' },
      category: categoryList?.[0]?.key || '',
      price: '',
      sku: '',
      images: ['', '', ''],
      stock: '0',
      critical_stock: '0',
      stock_date: new Date().toISOString().split('T')[0],
      stock_party: '',
      stock_note: '',
    })

  const handleNewProductChange = (path, value) => {
    if (path.startsWith('name.') || path.startsWith('description.')) {
      const [key, sub] = path.split('.')
      setNewProduct(prev => ({ ...prev, [key]: { ...prev[key], [sub]: value } }))
      return
    }
    setNewProduct(prev => ({ ...prev, [path]: value }))
  }

  const handleEditProductChange = (path, value) => {
    if (path.startsWith('name.') || path.startsWith('description.')) {
      const [key, sub] = path.split('.')
      setEditProduct(prev => ({ ...prev, [key]: { ...prev[key], [sub]: value } }))
      return
    }
    setEditProduct(prev => ({ ...prev, [path]: value }))
  }

  const addProduct = async (ev) => {
    ev.preventDefault()
    try {
      const [primaryImg, ...extraImgs] = newProduct.images
      const payload = {
        sku: newProduct.sku || `P-${Date.now()}`,
        category: newProduct.category,
        price: Number(newProduct.price) || 0,
        name: newProduct.name,
        description: newProduct.description,
        imageData: primaryImg || undefined,
        critical_stock: Number(newProduct.critical_stock) || 0,
      }
      const res = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      for (const imgData of extraImgs) {
        if (imgData) {
          await fetch(`${API_BASE}/api/products/${created.id}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ imageData: imgData }),
          })
        }
      }
      const stockQty = Math.max(0, Number(newProduct.stock) || 0)
      if (stockQty > 0 && created.id) {
        await fetch(`${API_BASE}/api/stock/in`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({
            product_id: created.id,
            quantity: stockQty,
            party: newProduct.stock_party || '',
            note: newProduct.stock_note || '',
            date: newProduct.stock_date || new Date().toISOString().split('T')[0],
          }),
        })
      }
      await loadProducts()
      resetNewProduct()
    } catch {
      setError('Не може да се додаде производ.')
    }
  }

  const startEditProduct = (product) => {
    setEditingProductId(product.id)
    setEditProduct({
      name: { ...product.name },
      description: { ...product.description },
      category: product.category,
      price: String(product.price),
      sku: product.sku,
      images: product.images || [],
      pendingImages: [],
      stock: String(product.stock ?? 0),
      critical_stock: String(product.critical_stock ?? 0),
    })
    setEditModalOpen(true)
  }

  const saveEditProduct = async (ev) => {
    ev.preventDefault()
    try {
      const payload = {
        sku: editProduct.sku,
        category: editProduct.category,
        price: Number(editProduct.price) || 0,
        name: editProduct.name,
        description: editProduct.description,
        critical_stock: Number(editProduct.critical_stock ?? 0) || 0,
      }
      const res = await fetch(`${API_BASE}/api/products/${editingProductId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `Серверска грешка (${res.status})`)
      }
      for (const imgData of (editProduct.pendingImages || [])) {
        if (imgData) {
          await fetch(`${API_BASE}/api/products/${editingProductId}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
            body: JSON.stringify({ imageData: imgData }),
          })
        }
      }
      await fetch(`${API_BASE}/api/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ product_id: editingProductId, quantity: Math.max(0, Number(editProduct.stock) || 0) }),
      })
      await loadProducts()
      setEditingProductId(null)
      setEditProduct(null)
      setEditModalOpen(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteEditImage = async (imageId) => {
    try {
      await fetch(`${API_BASE}/api/products/${editingProductId}/images/${imageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      setEditProduct(prev => ({ ...prev, images: prev.images.filter(img => img.id !== imageId) }))
    } catch {
      setError('Не може да се избрише сликата.')
    }
  }

  const setPrimaryEditImage = async (imageId) => {
    try {
      await fetch(`${API_BASE}/api/products/${editingProductId}/images/${imageId}/primary`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      setEditProduct(prev => ({
        ...prev,
        images: prev.images.map(img => ({ ...img, is_primary: img.id === imageId ? 1 : 0 })),
      }))
    } catch {
      setError('Не може да се постави главна слика.')
    }
  }

  const handleImgDragStart = (e, idx) => {
    imgDragRef.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleImgDrop = async (e, toIdx) => {
    e.preventDefault()
    const fromIdx = imgDragRef.current
    imgDragRef.current = null
    if (fromIdx === null || fromIdx === toIdx) return
    const images = [...(editProduct.images || [])]
    const [moved] = images.splice(fromIdx, 1)
    images.splice(toIdx, 0, moved)
    setEditProduct(prev => ({ ...prev, images }))
    try {
      await fetch(`${API_BASE}/api/products/${editingProductId}/images/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ order: images.map(img => img.id) }),
      })
    } catch { /* non-critical */ }
  }

  const deleteProduct = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `Серверска грешка (${res.status})`)
      }
      await loadProducts()
      if (editingProductId === id) { setEditingProductId(null); setEditProduct(null) }
    } catch (err) {
      setError(err.message)
    }
  }

  const exportProducts = () => {
    const blob = new Blob([JSON.stringify(productList, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'products.json'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const importProductsFromFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result)
        if (Array.isArray(parsed)) setProductList(parsed)
      } catch { setError('Некоректен JSON датотека.') }
    }
    reader.readAsText(file)
  }

  const toggleManualOrdered = (productId) => {
    setManualOrderedIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) { next.delete(productId) } else { next.add(productId) }
      return next
    })
    setFulfilledIds(prev => { const next = new Set(prev); next.delete(productId); return next })
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────────
  const handleProdDragStart = (e, id) => {
    dragProductRef.current = { id, position: 'after' }
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleProdDragOver = (e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const position = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
    dragProductRef.current.position = position
    setDropProductTarget(prev => prev.id === id && prev.position === position ? prev : { id, position })
  }

  const handleProdDrop = async (e, targetId) => {
    e.preventDefault()
    const srcId = dragProductRef.current.id
    const position = dragProductRef.current.position || 'after'
    dragProductRef.current = { id: null, position: 'after' }
    setDropProductTarget({ id: null, position: null })
    if (!srcId || srcId === targetId) return
    const all = [...productList]
    const srcIdx = all.findIndex(p => p.id === srcId)
    if (srcIdx === -1) return
    const [srcItem] = all.splice(srcIdx, 1)
    const tgtIdx = all.findIndex(p => p.id === targetId)
    if (tgtIdx === -1) return
    all.splice(position === 'before' ? tgtIdx : tgtIdx + 1, 0, srcItem)
    const updates = all.map((p, i) => ({ id: p.id, sort_order: i }))
    try {
      await fetch(`${API_BASE}/api/products/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(updates),
      })
      await loadProducts()
    } catch { setError('Не може да се зачува редоследот.') }
  }

  const handleProdDragEnd = () => {
    dragProductRef.current = { id: null, position: 'after' }
    setDropProductTarget({ id: null, position: null })
  }

  return {
    productList, setProductList,
    loading,
    newProduct, setNewProduct,
    editingProductId, setEditingProductId,
    editProduct, setEditProduct,
    editModalOpen, setEditModalOpen,
    dragProductRef,
    imgDragRef,
    dropProductTarget,
    adminStockFilter, setAdminStockFilter,
    fulfilledIds, setFulfilledIds,
    manualOrderedIds, setManualOrderedIds,
    isInStock,
    isCriticalStock,
    loadProducts,
    resetNewProduct,
    handleNewProductChange,
    handleEditProductChange,
    addProduct,
    startEditProduct,
    saveEditProduct,
    deleteEditImage,
    setPrimaryEditImage,
    handleImgDragStart,
    handleImgDrop,
    handleProdDragStart,
    handleProdDragOver,
    handleProdDrop,
    handleProdDragEnd,
    deleteProduct,
    exportProducts,
    importProductsFromFile,
    toggleManualOrdered,
  }
}
