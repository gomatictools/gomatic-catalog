import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, ShoppingCart, X, Package, CheckCircle2, XCircle,
  Settings, ClipboardList, ChevronLeft, ChevronRight, ChevronDown, Truck, LogOut, User,
  Plus, Minus, Tag, AlertTriangle, ArrowDownCircle, ArrowUpCircle, History,
  LayoutGrid, AlignJustify
} from 'lucide-react'
import './App.css'
import { translations } from './data'
import logoSrc from './assets/logo.png'

const API_BASE = import.meta.env.VITE_API_BASE || ''
const availableLanguages = [
  { code: 'mk', label: 'Македонски' },
  { code: 'sr', label: 'Српски' },
  { code: 'sq', label: 'Албански' },
  { code: 'en', label: 'English' },
]

const slugify = (text) => {
  const map = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','ѓ':'gj','е':'e','ж':'zh',
    'з':'z','ѕ':'dz','и':'i','ј':'j','к':'k','л':'l','љ':'lj','м':'m',
    'н':'n','њ':'nj','о':'o','п':'p','р':'r','с':'s','т':'t','ќ':'kj',
    'у':'u','ф':'f','х':'h','ц':'c','ч':'ch','џ':'dj','ш':'sh',
  }
  return text.toLowerCase().split('').map(c => map[c] ?? c).join('')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 50) || `cat_${Date.now()}`
}

const emptyNewCategory = () => ({ name: { mk: '', sr: '', sq: '', en: '' }, parent_key: null })

function App() {
  const [language, setLanguage] = useState('mk')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [cart, setCart] = useState([])
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminTab, setAdminTab] = useState('products')
  const [adminContentOpen, setAdminContentOpen] = useState(false)
  const [productList, setProductList] = useState([])
  const [categoryList, setCategoryList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
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
  const [newCategory, setNewCategory] = useState(emptyNewCategory())
  const [editingCategoryKey, setEditingCategoryKey] = useState(null)
  const [editCategory, setEditCategory] = useState({ name: { mk: '', sr: '', sq: '', en: '' }, parent_key: null })
  const [editingProductId, setEditingProductId] = useState(null)
  const [editProduct, setEditProduct] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [expandedRoot, setExpandedRoot] = useState(null)
  const dragStateRef = useRef({ key: null, position: null })
  const dragProductRef = useRef({ id: null, position: 'after' })
  const imgDragRef = useRef(null)
  const [dropTarget, setDropTarget] = useState({ key: null, position: null })
  const [dropProductTarget, setDropProductTarget] = useState({ id: null, position: null })

  // ── Auth state ────────────────────────────────────────────────────────────────
  const [authUser, setAuthUser] = useState(null)
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token'))
  const [authModal, setAuthModal] = useState(null)
  const [authTab, setAuthTab] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', name: '', password: '', confirm_password: '', company_name: '', is_private: false, phone: '' })
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [orderNote, setOrderNote] = useState('')
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [orderResult, setOrderResult] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [cardQuantities, setCardQuantities] = useState({})
  const [stockModal, setStockModal] = useState(null)
  const [stockForm, setStockForm] = useState({ quantity: '1', party: '', note: '', date: '' })
  const [stockHistory, setStockHistory] = useState(null)
  const [stockHistoryData, setStockHistoryData] = useState([])
  const [carouselIdx, setCarouselIdx] = useState(0)
  const [modalQty, setModalQty] = useState(1)
  const [myOrdersOpen, setMyOrdersOpen] = useState(false)
  const [myOrders, setMyOrders] = useState([])
  const [allOrders, setAllOrders] = useState([])
  const [orderEdits, setOrderEdits] = useState({})
  const [usersList, setUsersList] = useState([])
  const [userEdits, setUserEdits] = useState({})
  const [userSearch, setUserSearch] = useState('')
  const [cartAnimKey, setCartAnimKey] = useState(0)
  const [flashProductId, setFlashProductId] = useState(null)
  const flashTimerRef = useRef(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [orderFilterDateFrom, setOrderFilterDateFrom] = useState('')
  const [orderFilterDateTo, setOrderFilterDateTo] = useState('')
  const [orderFilterStatus, setOrderFilterStatus] = useState('all')
  const [orderFilterPayment, setOrderFilterPayment] = useState('all')
  const [orderFilterUser, setOrderFilterUser] = useState('')
  const [adminStockFilter, setAdminStockFilter] = useState('all')
  const [fulfilledIds, setFulfilledIds] = useState(new Set())
  const [manualOrderedIds, setManualOrderedIds] = useState(new Set())

  const locale = translations[language]
  const isAdmin = authUser?.role === 'admin'

  useEffect(() => { setCarouselIdx(0); setModalQty(1) }, [selectedProduct?.id])

  useEffect(() => { if (authUser?.role === 'admin') setAdminOpen(true) }, [authUser])

  // ── Category tree helpers ─────────────────────────────────────────────────────
  const catDepthMap = useMemo(() => {
    const map = {}
    const compute = (key, seen = new Set()) => {
      if (key in map) return map[key]
      if (seen.has(key)) return 0
      seen.add(key)
      const cat = categoryList.find(c => c.key === key)
      if (!cat || !cat.parent_key) return (map[key] = 0)
      return (map[key] = 1 + compute(cat.parent_key, seen))
    }
    categoryList.forEach(c => compute(c.key))
    return map
  }, [categoryList])

  const categoryTree = useMemo(() => {
    const nodeMap = {}
    categoryList.forEach(cat => { nodeMap[cat.key] = { ...cat, children: [] } })
    const roots = []
    categoryList.forEach(cat => {
      if (cat.parent_key && nodeMap[cat.parent_key]) {
        nodeMap[cat.parent_key].children.push(nodeMap[cat.key])
      } else {
        roots.push(nodeMap[cat.key])
      }
    })
    return roots
  }, [categoryList])

  const categoriesFlat = useMemo(() => {
    const result = []
    const dfs = (nodes) => {
      nodes.forEach(node => {
        result.push({ id: node.key, label: node.name[language] || node.key, depth: catDepthMap[node.key] ?? 0 })
        dfs(node.children)
      })
    }
    dfs(categoryTree)
    return result
  }, [categoryTree, language, catDepthMap])

  const getCategoryName = useCallback(
    (key) => {
      const cat = categoryList.find(c => c.key === key)
      return cat ? (cat.name[language] || key) : key
    },
    [categoryList, language],
  )

  const getCategoryChain = useCallback(
    (key) => {
      const chain = []
      let current = categoryList.find(c => c.key === key)
      while (current) {
        chain.unshift(current.name[language] || current.key)
        current = current.parent_key ? categoryList.find(c => c.key === current.parent_key) : null
      }
      return chain.length ? chain : [key]
    },
    [categoryList, language],
  )

  const getDescendantKeys = useCallback(
    (key) => {
      const keys = new Set([key])
      const addChildren = (k) => {
        categoryList.filter(c => c.parent_key === k).forEach(c => { keys.add(c.key); addChildren(c.key) })
      }
      addChildren(key)
      return keys
    },
    [categoryList],
  )

  const validParentOptions = useMemo(
    () => categoriesFlat.filter(c => (catDepthMap[c.id] ?? 0) <= 1),
    [categoriesFlat, catDepthMap],
  )

  const editParentOptions = useMemo(() => {
    if (!editingCategoryKey) return validParentOptions
    const excluded = getDescendantKeys(editingCategoryKey)
    excluded.add(editingCategoryKey)
    return validParentOptions.filter(c => !excluded.has(c.id))
  }, [validParentOptions, editingCategoryKey, getDescendantKeys])

  // ── Data loading ──────────────────────────────────────────────────────────────
  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCategoryList(data)
      setNewProduct(prev => ({ ...prev, category: prev.category || data[0]?.key || '' }))
    } catch { /* silent */ }
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

  useEffect(() => { loadCategories(); loadProducts() }, [])

  useEffect(() => {
    if (!authToken) { setAuthUser(null); return }
    fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setAuthUser(data.user)
        else { setAuthToken(null); localStorage.removeItem('auth_token') }
      })
      .catch(() => { setAuthToken(null); localStorage.removeItem('auth_token') })
  }, [authToken])

  useEffect(() => {
    if (isAdmin && authToken) {
      fetch(`${API_BASE}/api/orders`, { headers: { Authorization: `Bearer ${authToken}` } })
        .then(r => r.ok ? r.json() : [])
        .then(data => setAllOrders(data))
        .catch(() => {})
    }
  }, [isAdmin, authToken])

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const openAuthModal = (tab = 'login') => {
    setAuthTab(tab)
    setAuthForm({ email: '', name: '', password: '', confirm_password: '', company_name: '', is_private: false, phone: '' })
    setAuthError('')
    setAuthModal(true)
  }

  const handleAuthSubmit = async (ev) => {
    ev.preventDefault()
    setAuthError('')
    if (authTab === 'register' && authForm.password !== authForm.confirm_password) {
      setAuthError('Лозинките не се совпаѓаат.'); return
    }
    setAuthLoading(true)
    try {
      const endpoint = authTab === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = authTab === 'login'
        ? { email: authForm.email, password: authForm.password }
        : { email: authForm.email, name: authForm.name, password: authForm.password, company_name: authForm.company_name, is_private: authForm.is_private, phone: authForm.phone }
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setAuthError(data.error || 'Грешка'); return }
      localStorage.setItem('auth_token', data.token)
      setAuthToken(data.token)
      setAuthUser(data.user)
      setAuthModal(null)
    } catch {
      setAuthError('Проблем со врска со серверот.')
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = () => {
    setAuthUser(null); setAuthToken(null)
    localStorage.removeItem('auth_token')
    setMyOrdersOpen(false)
  }

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
      await fetch(`${API_BASE}/api/orders/${orderId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } })
      setAllOrders(prev => prev.filter(o => o.id !== orderId))
    } catch { setError('Не може да се избрише нарачката.') }
  }

  const getOrderField = (order, field) =>
    orderEdits[order.id]?.[field] !== undefined ? orderEdits[order.id][field] : order[field]

  const setOrderEdit = (orderId, field, value) =>
    setOrderEdits(prev => ({ ...prev, [orderId]: { ...prev[orderId], [field]: value } }))

  const loadUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, { headers: { Authorization: `Bearer ${authToken}` } })
      if (res.ok) { setUsersList(await res.json()); setUserEdits({}) }
    } catch { /* silent */ }
  }

  const getUserField = (user, field) =>
    userEdits[user.id]?.[field] !== undefined ? userEdits[user.id][field] : user[field]

  const setUserEdit = (userId, field, value) =>
    setUserEdits(prev => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }))

  const saveUser = async (userId) => {
    const edits = userEdits[userId]
    if (!edits) return
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(edits),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Грешка.'); return }
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, ...edits } : u))
      setUserEdits(prev => { const n = { ...prev }; delete n[userId]; return n })
    } catch { setError('Не може да се зачува корисникот.') }
  }

  const deleteUser = async (userId) => {
    const u = usersList.find(x => x.id === userId)
    if (!window.confirm(`Сигурно сакате да го избришете корисникот „${u?.name || u?.email}"? Ќе се избришат и неговите нарачки.`)) return
    try {
      await fetch(`${API_BASE}/api/admin/users/${userId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } })
      setUsersList(prev => prev.filter(u => u.id !== userId))
    } catch { setError('Не може да се избрише корисникот.') }
  }

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

  const openStockModal = (type, product) => {
    const today = new Date().toISOString().split('T')[0]
    setStockForm({ quantity: '1', party: '', note: '', date: today })
    setStockModal({ type, product })
  }

  const submitStockMovement = async (ev) => {
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


  // ── Product CRUD ──────────────────────────────────────────────────────────────
  const resetNewProduct = () =>
    setNewProduct({
      name: { mk: '', sr: '', sq: '', en: '' },
      description: { mk: '', sr: '', sq: '', en: '' },
      category: categoryList[0]?.key || '',
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

  const handleImageFile = (file, setter) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setter(prev => ({ ...prev, imageData: e.target.result }))
    reader.readAsDataURL(file)
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
      const res = await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } })
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

  // ── Category CRUD ─────────────────────────────────────────────────────────────
  const addCategory = async (ev) => {
    ev.preventDefault()
    const mkName = newCategory.name.mk.trim()
    if (!mkName) return
    const baseSlug = slugify(mkName)
    const prefix = newCategory.parent_key ? `${newCategory.parent_key}_` : ''
    let key = `${prefix}${baseSlug}`.slice(0, 50)
    if (categoryList.some(c => c.key === key)) {
      let i = 2
      while (categoryList.some(c => c.key === `${key}_${i}`)) i++
      key = `${key}_${i}`.slice(0, 50)
    }
    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ key, name: newCategory.name, parent_key: newCategory.parent_key || null }),
      })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || 'Грешка') }
      await loadCategories()
      setNewCategory(emptyNewCategory())
    } catch (err) {
      setError(err.message)
    }
  }

  const startEditCategory = (cat) => {
    setEditingCategoryKey(cat.key)
    setEditCategory({ name: { ...cat.name }, parent_key: cat.parent_key || null })
  }

  const saveCategory = async () => {
    const mkName = editCategory.name?.mk?.trim()
    if (!mkName) { setError('Македонскиот назив е задолжителен.'); return }
    if (!editingCategoryKey) return
    try {
      const res = await fetch(`${API_BASE}/api/categories/${encodeURIComponent(editingCategoryKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ name: editCategory.name, parent_key: editCategory.parent_key || null }),
      })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || 'Грешка') }
      await loadCategories()
      setEditingCategoryKey(null)
    } catch (err) {
      setError(err.message || 'Не може да се зачува категоријата.')
    }
  }

  const deleteCategory = async (key) => {
    try {
      const res = await fetch(`${API_BASE}/api/categories/${encodeURIComponent(key)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${authToken}` } })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || 'Грешка') }
      await loadCategories()
    } catch (err) {
      setError(err.message || 'Не може да се избрише категоријата.')
    }
  }

  // ── Category drag-and-drop ────────────────────────────────────────────────────
  const handleCatDragStart = (e, key) => {
    dragStateRef.current = { key, position: null }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
  }

  const handleCatDragOver = (e, key) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    dragStateRef.current.position = position
    setDropTarget(prev => prev.key === key && prev.position === position ? prev : { key, position })
  }

  const handleCatDrop = async (e, targetKey) => {
    e.preventDefault()
    const { key: srcKey, position } = dragStateRef.current
    dragStateRef.current = { key: null, position: null }
    setDropTarget({ key: null, position: null })
    if (!srcKey || srcKey === targetKey || !position) return
    const srcCat = categoryList.find(c => c.key === srcKey)
    const tgtCat = categoryList.find(c => c.key === targetKey)
    if (!srcCat || !tgtCat || srcCat.parent_key !== tgtCat.parent_key) return
    const siblings = categoryList.filter(c => c.parent_key === srcCat.parent_key)
    const withoutSrc = siblings.filter(c => c.key !== srcKey)
    const tgtIdx = withoutSrc.findIndex(c => c.key === targetKey)
    if (tgtIdx === -1) return
    const insertIdx = position === 'before' ? tgtIdx : tgtIdx + 1
    withoutSrc.splice(insertIdx, 0, srcCat)
    const updates = withoutSrc.map((c, i) => ({ key: c.key, sort_order: i }))
    try {
      const res = await fetch(`${API_BASE}/api/categories/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `Серверска грешка (${res.status})`)
      }
      await loadCategories()
    } catch (err) {
      setError(err.message || 'Не може да се зачува редоследот.')
    }
  }

  const handleCatDragEnd = () => {
    dragStateRef.current = { key: null, position: null }
    setDropTarget({ key: null, position: null })
  }

  // ── Product drag-and-drop ─────────────────────────────────────────────────────
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

  // ── Misc ──────────────────────────────────────────────────────────────────────
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

  // ── Stock helpers ─────────────────────────────────────────────────────────────
  const isInStock = (product) => (product.stock ?? 0) > 0

  const isCriticalStock = (product) => {
    const stock = product.stock ?? 0
    const critical = product.critical_stock ?? 0
    return stock > 0 && critical > 0 && stock <= critical
  }

  // ── Derived data ──────────────────────────────────────────────────────────────
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

  const pendingOrderProductIds = useMemo(() => {
    const ids = new Set()
    orderedProductIds.forEach(id => { if (!fulfilledIds.has(id)) ids.add(id) })
    manualOrderedIds.forEach(id => { if (!fulfilledIds.has(id)) ids.add(id) })
    return ids
  }, [orderedProductIds, manualOrderedIds, fulfilledIds])

  const toggleManualOrdered = (productId) => {
    setManualOrderedIds(prev => {
      const next = new Set(prev)
      if (next.has(productId)) { next.delete(productId) } else { next.add(productId) }
      return next
    })
    setFulfilledIds(prev => { const next = new Set(prev); next.delete(productId); return next })
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const descendantKeys = selectedCategory === 'all' ? null : getDescendantKeys(selectedCategory)
    return productList.filter(product => {
      if (descendantKeys && !descendantKeys.has(product.category)) return false
      if (q && !`${product.name[language]} ${product.description[language]} ${product.sku}`.toLowerCase().includes(q)) return false
      if (adminStockFilter === 'critical') return isCriticalStock(product)
      if (adminStockFilter === 'out') return !isInStock(product)
      if (adminStockFilter === 'ordered') return pendingOrderProductIds.has(product.id)
      return true
    })
  }, [search, selectedCategory, language, productList, getDescendantKeys, adminStockFilter, orderedProductIds])

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

  const cartItems = cart
    .map(entry => {
      const product = productList.find(p => p.id === entry.productId)
      return product ? { ...entry, product, subtotal: product.price * entry.quantity } : null
    })
    .filter(Boolean)

  const totalPrice = cartItems.reduce((sum, item) => sum + item.subtotal, 0)
  const totalCartQty = cart.reduce((s, e) => s + e.quantity, 0)

  // ── Render helpers ────────────────────────────────────────────────────────────
  const renderSidebarTree = (nodes, depth = 0) =>
    nodes.map(node => {
      const hasChildren = node.children?.length > 0
      const isRoot = depth === 0
      const isExpanded = isRoot ? expandedRoot === node.key : true
      return (
        <div key={node.key} className={`sidebar-tree-node depth-${depth}`}>
          <button
            type="button"
            className={selectedCategory === node.key ? 'active' : ''}
            onClick={() => {
              setSelectedCategory(node.key)
              if (isRoot && hasChildren)
                setExpandedRoot(prev => prev === node.key ? null : node.key)
            }}
          >
            {isRoot && hasChildren && (
              <span className="sidebar-chevron">
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
            )}
            {node.name[language] || node.key}
          </button>
          {hasChildren && isExpanded && (
            <div className="sidebar-tree-children">{renderSidebarTree(node.children, depth + 1)}</div>
          )}
        </div>
      )
    })

  const renderCategoryAdminTree = (nodes, depth = 0) =>
    nodes.map(node => (
      <div key={node.key} className={`category-admin-node depth-${depth}`}>
        {editingCategoryKey === node.key ? (
          <div className="category-edit-inline">
            {availableLanguages.map(lang => (
              <div key={lang.code} className="admin-group">
                <label>{lang.label}</label>
                <input
                  value={editCategory.name[lang.code]}
                  onChange={e => setEditCategory(prev => ({ ...prev, name: { ...prev.name, [lang.code]: e.target.value } }))}
                />
              </div>
            ))}
            <div className="admin-group">
              <label>Родителска</label>
              <select
                value={editCategory.parent_key || ''}
                onChange={e => setEditCategory(prev => ({ ...prev, parent_key: e.target.value || null }))}
              >
                <option value="">— Главна категорија —</option>
                {editParentOptions.map(c => (
                  <option key={c.id} value={c.id}>{'   '.repeat(c.depth)}{c.depth > 0 ? '└ ' : ''}{c.label}</option>
                ))}
              </select>
            </div>
            <div className="category-edit-actions">
              <button type="button" className="btn-save" onClick={saveCategory}>Зачувај</button>
              <button type="button" className="btn-cancel" onClick={() => setEditingCategoryKey(null)}>Откажи</button>
            </div>
          </div>
        ) : (
          <div
            className={`category-item${dropTarget.key === node.key ? ` drop-${dropTarget.position}` : ''}`}
            draggable
            onDragStart={e => handleCatDragStart(e, node.key)}
            onDragOver={e => handleCatDragOver(e, node.key)}
            onDrop={e => handleCatDrop(e, node.key)}
            onDragEnd={handleCatDragEnd}
          >
            <span className="drag-handle" title="Превлечи за да прередиш">⠿</span>
            <span className="category-item-name">{node.name.mk}</span>
            <span className="category-item-langs">{node.name.sr} / {node.name.sq} / {node.name.en}</span>
            <button type="button" className="btn-edit-sm" onClick={() => startEditCategory(node)}>Уреди</button>
            <button type="button" className="category-delete" onClick={() => deleteCategory(node.key)} title="Избриши">✕</button>
          </div>
        )}
        {node.children?.length > 0 && (
          <div className="category-admin-children">{renderCategoryAdminTree(node.children, depth + 1)}</div>
        )}
      </div>
    ))

  // ── Stock helpers ─────────────────────────────────────────────────────────────
  const StockBadge = ({ product, critical }) => {
    if (isInStock(product)) {
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

  // ── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <div className="catalog-app">

      {/* ── Header ── */}
      <header className="catalog-header">
        <div className="catalog-header__inner">

          {/* Logo */}
          <div className="header-logo">
            <img src={logoSrc} alt="GOMATIC Tools" className="header-logo__img" />
          </div>

          {/* Search */}
          <div className="header-search">
            <Search size={15} className="header-search__icon" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={locale.searchPlaceholder}
            />
          </div>

          {/* Actions */}
          <div className="header-actions">
            <div className="lang-flags">
              {[
                { code: 'mk', flag: '🇲🇰', title: 'Македонски' },
                { code: 'sr', flag: '🇷🇸', title: 'Српски' },
                { code: 'sq', flag: '🇦🇱', title: 'Shqip' },
                { code: 'en', flag: '🇬🇧', title: 'English' },
              ].map(l => (
                <button key={l.code} type="button" title={l.title}
                  className={`flag-btn${language === l.code ? ' active' : ''}`}
                  onClick={() => setLanguage(l.code)}
                >{l.flag}</button>
              ))}
            </div>

            {authUser ? (
              <>
                <span className="header-user-name">{authUser.name}</span>
                {authUser.role !== 'admin' && (
                  <button type="button" className="btn-auth-outline" onClick={() => { setMyOrdersOpen(true); loadMyOrders() }}>
                    <ClipboardList size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    {locale.myOrders}
                  </button>
                )}
                <button type="button" className="btn-auth-outline" onClick={logout}>
                  <LogOut size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  {locale.logout}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn-auth-outline" onClick={() => openAuthModal('login')}>{locale.login}</button>
                <button type="button" className="btn-auth" onClick={() => openAuthModal('register')}>{locale.register}</button>
              </>
            )}

            {authUser?.role !== 'admin' && (
              <button type="button" className="btn-cart" onClick={() => setCartOpen(true)}>
                <span key={cartAnimKey} className="cart-icon-bump"><ShoppingCart size={15} /></span>
                {locale.cartTitle}
                {totalCartQty > 0 && <span className="cart-badge">{totalCartQty}</span>}
              </button>
            )}

            {authUser?.role === 'admin' && (
              <button type="button" className="admin-toggle" onClick={() => setAdminOpen(v => !v)}>
                <Settings size={13} />
                {adminOpen ? 'Затвори' : 'Admin'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Admin panel ── */}
      {adminOpen && authUser?.role === 'admin' && (
        <section className="admin-panel">
          <div className="admin-panel__tabs-bar">
            <div className="admin-panel__inner">
              <div className="admin-tabs">
                {[
                  { key: 'products',   label: 'Додавање производи' },
                  { key: 'categories', label: 'Додавање категории' },
                  { key: 'catalog',    label: 'Уредување на каталог' },
                  { key: 'db',         label: 'Управување со база' },
                  { key: 'orders',     label: 'Нарачки' },
                  { key: 'users',      label: 'Корисници' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`admin-tab${adminTab === tab.key && adminContentOpen ? ' active' : ''}`}
                    onClick={() => {
                      if (adminTab === tab.key) {
                        setAdminContentOpen(v => !v)
                      } else {
                        setAdminTab(tab.key)
                        setAdminContentOpen(true)
                        if (tab.key === 'orders') loadAllOrders()
                        if (tab.key === 'users') loadUsers()
                      }
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {adminContentOpen && (
          <div className="admin-panel__inner">

          {/* Таб: Уредување на каталог */}
          {adminTab === 'catalog' && (
            <div className="admin-section">
              {editingProductId !== null && editProduct ? (
                <>
                  <h3>Уреди производ — {editProduct.sku}</h3>
                  <form onSubmit={saveEditProduct} className="admin-form">
                    <div className="admin-grid">
                      {availableLanguages.map(lang => (
                        <div key={lang.code} className="admin-group">
                          <label>Назив ({lang.label})</label>
                          <input value={editProduct.name[lang.code]} onChange={e => handleEditProductChange(`name.${lang.code}`, e.target.value)} />
                          <label>Опис ({lang.label})</label>
                          <textarea value={editProduct.description[lang.code]} onChange={e => handleEditProductChange(`description.${lang.code}`, e.target.value)} />
                        </div>
                      ))}
                      <div className="admin-group">
                        <label>Категорија</label>
                        <select value={editProduct.category} onChange={e => handleEditProductChange('category', e.target.value)}>
                          {categoriesFlat.map(cat => (
                            <option key={cat.id} value={cat.id}>{'   '.repeat(cat.depth)}{cat.depth > 0 ? '└ ' : ''}{cat.label}</option>
                          ))}
                        </select>
                        <label>Цена</label>
                        <input value={editProduct.price} onChange={e => handleEditProductChange('price', e.target.value)} />
                        <label>SKU</label>
                        <input value={editProduct.sku} onChange={e => handleEditProductChange('sku', e.target.value)} />
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
                    </div>
                    <div className="admin-actions">
                      <button type="submit" className="btn-save">Зачувај промени</button>
                      <button type="button" className="btn-cancel" onClick={() => { setEditingProductId(null); setEditProduct(null) }}>Откажи</button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <h3>Категории</h3>
                  <div className="category-admin-tree">
                    {renderCategoryAdminTree(categoryTree)}
                    {categoryTree.length === 0 && <p className="empty-hint">Нема додадени категории.</p>}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Таб: Додавање категории */}
          {adminTab === 'categories' && (
            <div className="admin-section">
              <h3>Додај категорија</h3>
              <form onSubmit={addCategory} className="category-add-form">
                <div className="category-add-grid">
                  {availableLanguages.map(lang => (
                    <div key={lang.code} className="admin-group">
                      <label>Назив ({lang.label})</label>
                      <input
                        value={newCategory.name[lang.code]}
                        onChange={e => setNewCategory(prev => ({ ...prev, name: { ...prev.name, [lang.code]: e.target.value } }))}
                        required={lang.code === 'mk'}
                        placeholder={lang.code === 'mk' ? 'Задолжително' : 'Незадолжително'}
                      />
                    </div>
                  ))}
                  <div className="admin-group">
                    <label>Родителска категорија</label>
                    <select
                      value={newCategory.parent_key || ''}
                      onChange={e => setNewCategory(prev => ({ ...prev, parent_key: e.target.value || null }))}
                    >
                      <option value="">— Главна категорија —</option>
                      {validParentOptions.map(c => (
                        <option key={c.id} value={c.id}>{'   '.repeat(c.depth)}{c.depth > 0 ? '└ ' : ''}{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="category-add-btn">+ Додај категорија</button>
              </form>
            </div>
          )}

          {/* Таб: Додавање производи */}
          {adminTab === 'products' && (
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
          )}

          {/* Таб: Управување со база */}
          {adminTab === 'db' && (
            <div className="admin-section">
              <h3>Управување со база</h3>
              <div className="db-actions">
                <div className="db-action-group">
                  <h4>Производи</h4>
                  <p>Извоз или увоз на листата на производи во JSON формат.</p>
                  <div className="admin-actions">
                    <button type="button" onClick={exportProducts}>Извоз JSON</button>
                    <label className="import-file">
                      Увоз JSON
                      <input type="file" accept="application/json" style={{ display: 'none' }} onChange={e => importProductsFromFile(e.target.files?.[0])} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {adminTab === 'orders' && (
            <div className="admin-section">
              <div className="orders-tab-header">
                <h3>Нарачки</h3>
                <button type="button" className="btn-sm" onClick={loadAllOrders}>Освежи</button>
              </div>

              <div className="orders-filters">
                <input
                  type="text"
                  className="orders-filter-search"
                  placeholder="Корисник или компанија…"
                  value={orderFilterUser}
                  onChange={e => setOrderFilterUser(e.target.value)}
                />
                <select className="orders-filter-select" value={orderFilterStatus} onChange={e => setOrderFilterStatus(e.target.value)}>
                  <option value="all">Сите статуси</option>
                  <option value="pending">Во чекање</option>
                  <option value="ready">Спремено</option>
                  <option value="delivered">Испорачано</option>
                </select>
                <select className="orders-filter-select" value={orderFilterPayment} onChange={e => setOrderFilterPayment(e.target.value)}>
                  <option value="all">Сите плаќања</option>
                  <option value="unpaid">Не е наплатено</option>
                  <option value="paid">Наплатено</option>
                </select>
                <div className="orders-filter-dates">
                  <input type="date" className="orders-filter-date" value={orderFilterDateFrom} onChange={e => setOrderFilterDateFrom(e.target.value)} title="Од датум" />
                  <span className="orders-filter-date-sep">–</span>
                  <input type="date" className="orders-filter-date" value={orderFilterDateTo} onChange={e => setOrderFilterDateTo(e.target.value)} title="До датум" />
                </div>
                {(orderFilterUser || orderFilterStatus !== 'all' || orderFilterPayment !== 'all' || orderFilterDateFrom || orderFilterDateTo) && (
                  <button type="button" className="orders-filter-clear" onClick={() => { setOrderFilterUser(''); setOrderFilterStatus('all'); setOrderFilterPayment('all'); setOrderFilterDateFrom(''); setOrderFilterDateTo('') }}>✕</button>
                )}
                <span className="orders-filter-count">{filteredOrders.length} / {allOrders.length}</span>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="empty-state" style={{ border: 'none', padding: '32px 0' }}>
                  <Package size={36} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
                  <p>{allOrders.length === 0 ? 'Нема нарачки.' : 'Нема нарачки според избраните филтри.'}</p>
                </div>
              ) : (
                <div className="orders-list">
                  {filteredOrders.map(order => {
                    const deliveryStatus = getOrderField(order, 'status')
                    const paymentStatus = getOrderField(order, 'payment_status')
                    const isDirty = !!orderEdits[order.id]
                    return (
                      <div key={order.id} className="order-card">
                        <div className="order-card-header">
                          <span className="order-id">#{order.id}</span>
                          <span className="order-client">
                            {order.company_name ? <strong>{order.company_name}</strong> : null}
                            {order.company_name && order.user_name ? ' · ' : null}
                            {order.user_name}
                          </span>
                          <span className="order-date">{new Date(order.created_at).toLocaleDateString()}</span>
                          <strong className="order-total">{order.total.toFixed(2)} €</strong>
                        </div>

                        <ul className="order-items-list">
                          {order.items.map(item => (
                            <li key={item.id}>{item.name} × {item.quantity} — {(item.price * item.quantity).toFixed(2)} €</li>
                          ))}
                        </ul>
                        {order.note && <p className="order-note-text">{order.note}</p>}

                        <div className="order-controls">
                          <div className="order-selects">
                            <select
                              className={`order-select order-select--delivery order-select--${deliveryStatus}`}
                              value={deliveryStatus}
                              onChange={e => setOrderEdit(order.id, 'status', e.target.value)}
                            >
                              <option value="pending">Во чекање</option>
                              <option value="ready">Спремено</option>
                              <option value="delivered">Испорачано</option>
                            </select>
                            <select
                              className={`order-select order-select--payment order-select--${paymentStatus}`}
                              value={paymentStatus || 'unpaid'}
                              onChange={e => setOrderEdit(order.id, 'payment_status', e.target.value)}
                            >
                              <option value="unpaid">Не е наплатено</option>
                              <option value="paid">Наплатено</option>
                            </select>
                          </div>
                          <div className="order-actions">
                            {isDirty && <button type="button" className="btn-order-save" onClick={() => saveOrder(order.id)}>Зачувај</button>}
                            {isDirty && <button type="button" className="btn-order-cancel" onClick={() => setOrderEdits(prev => { const n = { ...prev }; delete n[order.id]; return n })}>Откажи</button>}
                            <button type="button" className="btn-order-delete" onClick={() => deleteOrder(order.id)}>Избриши</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {adminTab === 'users' && (
            <div className="admin-section">
              <div className="orders-tab-header">
                <h3>Корисници</h3>
                <button type="button" className="btn-sm" onClick={loadUsers}>Освежи</button>
              </div>

              <div className="users-search-bar">
                <input
                  type="text"
                  className="orders-filter-search"
                  placeholder="Пребарај по ime, компанија или е-пошта…"
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                />
                <span className="orders-filter-count">
                  {usersList.filter(u => {
                    const q = userSearch.toLowerCase()
                    return !q || (u.name||'').toLowerCase().includes(q) || (u.company_name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)
                  }).length} / {usersList.length}
                </span>
              </div>

              {usersList.length === 0 ? (
                <div className="empty-state" style={{ border: 'none', padding: '32px 0' }}>
                  <Package size={36} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
                  <p>Нема корисници.</p>
                </div>
              ) : (
                <div className="users-list">
                  {usersList
                    .filter(u => {
                      const q = userSearch.toLowerCase()
                      return !q || (u.name||'').toLowerCase().includes(q) || (u.company_name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)
                    })
                    .map(user => {
                      const isDirty = !!userEdits[user.id]
                      return (
                        <div key={user.id} className={`user-card${user.role === 'admin' ? ' user-card--admin' : ''}`}>
                          <div className="user-card-meta">
                            <span className="user-card-id">#{user.id}</span>
                            <span className={`user-role-badge user-role-badge--${getUserField(user, 'role')}`}>
                              {getUserField(user, 'role') === 'admin' ? 'Админ' : 'Корисник'}
                            </span>
                            <span className="user-card-date">{new Date(user.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="user-card-fields">
                            <label className="user-field">
                              <span>Ime</span>
                              <input type="text" value={getUserField(user, 'name') || ''} onChange={e => setUserEdit(user.id, 'name', e.target.value)} />
                            </label>
                            <label className="user-field">
                              <span>Компанија</span>
                              <input type="text" value={getUserField(user, 'company_name') || ''} onChange={e => setUserEdit(user.id, 'company_name', e.target.value)} disabled={getUserField(user, 'is_private')} />
                            </label>
                            <label className="user-field">
                              <span>Е-пошта</span>
                              <input type="email" value={getUserField(user, 'email') || ''} onChange={e => setUserEdit(user.id, 'email', e.target.value)} />
                            </label>
                            <label className="user-field">
                              <span>Телефон</span>
                              <input type="text" value={getUserField(user, 'phone') || ''} onChange={e => setUserEdit(user.id, 'phone', e.target.value)} />
                            </label>
                            <label className="user-field user-field--inline">
                              <input type="checkbox" checked={!!getUserField(user, 'is_private')} onChange={e => setUserEdit(user.id, 'is_private', e.target.checked)} />
                              <span>Приватно лице</span>
                            </label>
                            <label className="user-field">
                              <span>Улога</span>
                              <select value={getUserField(user, 'role')} onChange={e => setUserEdit(user.id, 'role', e.target.value)}>
                                <option value="user">Корисник</option>
                                <option value="admin">Админ</option>
                              </select>
                            </label>
                          </div>
                          <div className="user-card-actions">
                            {isDirty && <button type="button" className="btn-order-save" onClick={() => saveUser(user.id)}>Зачувај</button>}
                            {isDirty && <button type="button" className="btn-order-cancel" onClick={() => setUserEdits(prev => { const n = { ...prev }; delete n[user.id]; return n })}>Откажи</button>}
                            <button type="button" className="btn-order-delete" onClick={() => deleteUser(user.id)}>Избриши</button>
                          </div>
                        </div>
                      )
                    })
                  }
                </div>
              )}
            </div>
          )}
          </div>
          )}
        </section>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="error-banner" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>
          <X size={14} />
          {error}
        </div>
      )}

      {/* ── Main content ── */}
      <main className="catalog-main">

        {/* Sidebar */}
        <aside className="sidebar-categories" aria-label="Категории">
          <div className="sidebar-card">
            <h3>Категории</h3>
            <nav className="sidebar-list">
              <div className="sidebar-tree-node depth-0">
                <button
                  type="button"
                  className={selectedCategory === 'all' ? 'active' : ''}
                  onClick={() => setSelectedCategory('all')}
                >
                  <Tag size={13} />
                  {locale.categoryAll}
                </button>
              </div>
              {renderSidebarTree(categoryTree)}
            </nav>
          </div>
        </aside>

        {/* Product panel */}
        <section className="product-panel">
          <div className="catalog-controls">
            <span className="catalog-controls__results">
              {loading ? '' : `${filteredProducts.length} производ${filteredProducts.length === 1 ? '' : 'и'}`}
            </span>
            {isAdmin && adminOpen && (
              <div className="admin-stock-filters">
                {[
                  { key: 'all',      label: 'Сите производи' },
                  { key: 'critical', label: 'Критична залиха' },
                  { key: 'out',      label: 'Нема на залиха' },
                  { key: 'ordered',  label: 'Нарачано' },
                ].map(f => (
                  <button
                    key={f.key}
                    type="button"
                    className={`admin-stock-filter-btn${adminStockFilter === f.key ? ' active' : ''} filter--${f.key}`}
                    onClick={() => setAdminStockFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile category chips — only visible ≤1024px */}
          {!isAdmin && (
            <div className="mobile-cat-chips">
              <button
                type="button"
                className={`mobile-cat-chip${selectedCategory === 'all' ? ' active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                {locale.categoryAll}
              </button>
              {categoryTree.map(node => (
                <button
                  key={node.key}
                  type="button"
                  className={`mobile-cat-chip${selectedCategory === node.key ? ' active' : ''}`}
                  onClick={() => setSelectedCategory(node.key)}
                >
                  {node.name[language] || node.key}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="loading-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton-card">
                  <div className="skeleton-img" />
                  <div className="skeleton-body">
                    <div className="skeleton-line skeleton-line--short" />
                    <div className="skeleton-line" />
                    <div className="skeleton-line skeleton-line--price" />
                    <div className="skeleton-line skeleton-line--btn" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map(product => {
                const isAdmin = authUser?.role === 'admin'
                const isCritical = isAdmin && adminOpen && isCriticalStock(product)
                const isOrdered = isAdmin && adminOpen && pendingOrderProductIds.has(product.id)
                const cardQty = cardQuantities[product.id] ?? 1
                return (
                  <article
                    key={product.id}
                    className={`product-card${isAdmin && adminOpen ? ' admin-draggable' : ''}${dropProductTarget.id === product.id ? ` drop-prod-${dropProductTarget.position}` : ''}${isCritical ? ' product-card--critical' : ''}${isOrdered ? ' product-card--ordered' : ''}`}
                    draggable={!!(isAdmin && adminOpen)}
                    onDragStart={isAdmin && adminOpen ? e => handleProdDragStart(e, product.id) : undefined}
                    onDragOver={isAdmin && adminOpen ? e => handleProdDragOver(e, product.id) : undefined}
                    onDrop={isAdmin && adminOpen ? e => handleProdDrop(e, product.id) : undefined}
                    onDragEnd={isAdmin && adminOpen ? handleProdDragEnd : undefined}
                  >
                    {/* Image */}
                    <div className="product-image product-image--clickable" onClick={() => { if (!isAdmin) setSelectedProduct(product) }}>
                      {product.image_url
                        ? <img src={product.image_url} alt={product.name[language]} />
                        : <div className="product-image__no-img"><Package size={32} strokeWidth={1} /></div>
                      }
                      {!isInStock(product) && (
                        <div className="product-image__out-of-stock">Нема залиха</div>
                      )}
                      {isOrdered && (
                        <div className="product-image__ordered-badge">
                          Нарачано
                        </div>
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
                      <h2 className="product-name--clickable" onClick={() => { if (!isAdmin) setSelectedProduct(product) }}>
                        {product.name[language]}
                      </h2>

                      {/* SKU + stock (залиха само за admin) */}
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
                              onClick={() => setCardQuantities(prev => ({ ...prev, [product.id]: Math.max(1, (prev[product.id] ?? 1) - 1) }))}
                            >
                              <Minus size={10} />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={cardQty}
                              onChange={e => setCardQuantities(prev => ({ ...prev, [product.id]: Math.max(1, Number(e.target.value) || 1) }))}
                            />
                            <button
                              type="button"
                              className="card-qty__btn"
                              onClick={() => setCardQuantities(prev => ({ ...prev, [product.id]: (prev[product.id] ?? 1) + 1 }))}
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Admin: Влез / Излез | User: Додади во кошничка */}
                      {isAdmin ? (
                        <div className="admin-stock-btns">
                          <button type="button" className="btn-stock-in" onClick={() => openStockModal('in', product)}>
                            <ArrowDownCircle size={13} /> Влез
                          </button>
                          <button type="button" className="btn-stock-out" onClick={() => openStockModal('out', product)} disabled={!isInStock(product)}>
                            <ArrowUpCircle size={13} /> Излез
                          </button>
                          <button type="button" className="btn-stock-history" onClick={() => openStockHistory(product)} title="Историја на движења">
                            <History size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={flashProductId === product.id ? 'btn-add--flash' : ''}
                          onClick={() => {
                            addToCart(product.id, cardQty)
                            if (isInStock(product)) setCardQuantities(prev => ({ ...prev, [product.id]: 1 }))
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
                          <button type="button" className="btn-edit-sm" onClick={() => startEditProduct(product)}>Уреди</button>
                          <button type="button" className="btn-delete-sm" onClick={() => { if (window.confirm(`Сигурно сакате да го избришете „${product.name.mk || product.sku}"?`)) deleteProduct(product.id) }}>Избриши</button>
                          <button
                            type="button"
                            className={`btn-ordered-sm${isOrdered ? ' btn-ordered-sm--active' : ''}`}
                            onClick={() => toggleManualOrdered(product.id)}
                          >
                            {isOrdered ? 'Нарачано ✕' : 'Нарачано'}
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                )
              })}

              {filteredProducts.length === 0 && (
                <div className="empty-state">
                  <Package size={40} className="empty-state__icon" strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
                  <p>{locale.noProducts}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ── Auth modal ── */}
      {authModal && (
        <div className="product-modal-overlay" onMouseDown={() => setAuthModal(null)}>
          <div className="auth-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAuthModal(null)}>
              <X size={14} />
            </button>
            <div className="auth-tabs">
              <button type="button" className={authTab === 'login' ? 'auth-tab active' : 'auth-tab'}
                onClick={() => { setAuthTab('login'); setAuthError('') }}>{locale.loginTitle}</button>
              <button type="button" className={authTab === 'register' ? 'auth-tab active' : 'auth-tab'}
                onClick={() => { setAuthTab('register'); setAuthError('') }}>{locale.registerTitle}</button>
            </div>
            <form onSubmit={handleAuthSubmit} className="auth-form">
              {authTab === 'register' ? (
                <>
                  {!authForm.is_private && (
                    <label>Компанија
                      <input type="text" value={authForm.company_name} onChange={e => setAuthForm(p => ({ ...p, company_name: e.target.value }))} />
                    </label>
                  )}
                  <label className="auth-checkbox-label">
                    <input type="checkbox" checked={authForm.is_private}
                      onChange={e => setAuthForm(p => ({ ...p, is_private: e.target.checked, company_name: '' }))} />
                    Приватно лице
                  </label>
                  <label>{locale.name}
                    <input type="text" required value={authForm.name} onChange={e => setAuthForm(p => ({ ...p, name: e.target.value }))} />
                  </label>
                  <label>Телефон
                    <input type="tel" required value={authForm.phone} onChange={e => setAuthForm(p => ({ ...p, phone: e.target.value }))} placeholder="+389 XX XXX XXX" />
                  </label>
                  <label>{locale.email}
                    <input type="email" required value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
                  </label>
                  <label>{locale.password}
                    <input type="password" required minLength={6} value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
                  </label>
                  <label>Потврди лозинка
                    <input type="password" required minLength={6} value={authForm.confirm_password} onChange={e => setAuthForm(p => ({ ...p, confirm_password: e.target.value }))} />
                  </label>
                </>
              ) : (
                <>
                  <label>{locale.email}
                    <input type="email" required value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
                  </label>
                  <label>{locale.password}
                    <input type="password" required minLength={6} value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
                  </label>
                </>
              )}
              {authError && <p className="auth-error">{authError}</p>}
              <button type="submit" className="btn-auth-submit" disabled={authLoading}>
                {authLoading ? '…' : authTab === 'login' ? locale.loginBtn : locale.registerBtn}
              </button>
              <p className="auth-switch">
                {authTab === 'login' ? locale.noAccount : locale.hasAccount}{' '}
                <button type="button" className="link-btn" onClick={() => { setAuthTab(authTab === 'login' ? 'register' : 'login'); setAuthError('') }}>
                  {authTab === 'login' ? locale.registerTitle : locale.loginTitle}
                </button>
              </p>
            </form>
          </div>
        </div>
      )}

      {/* ── My orders modal ── */}
      {myOrdersOpen && (
        <div className="product-modal-overlay" onMouseDown={() => setMyOrdersOpen(false)}>
          <div className="orders-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setMyOrdersOpen(false)}><X size={14} /></button>
            <h2><ClipboardList size={17} />{locale.ordersTitle}</h2>
            {myOrders.length === 0 ? (
              <div className="empty-state" style={{ border: 'none', padding: '32px 0' }}>
                <Package size={36} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
                <p>{locale.noOrders}</p>
              </div>
            ) : (
              <div className="orders-list">
                {myOrders.map(order => (
                  <div key={order.id} className="order-card">
                    <div className="order-card-header">
                      <span>#{order.id}</span>
                      <span className="order-status">{order.status}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(order.created_at).toLocaleDateString()}</span>
                      <strong style={{ marginLeft: 'auto' }}>{order.total.toFixed(2)} €</strong>
                    </div>
                    <ul className="order-items-list">
                      {order.items.map(item => (
                        <li key={item.id}>{item.name} × {item.quantity} — {(item.price * item.quantity).toFixed(2)} €</li>
                      ))}
                    </ul>
                    {order.note && <p className="order-note-text">{order.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Cart modal ── */}
      {cartOpen && (
        <div className="product-modal-overlay" onMouseDown={() => setCartOpen(false)}>
          <div className="cart-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setCartOpen(false)}><X size={14} /></button>
            <h2><ShoppingCart size={17} />{locale.cartTitle}</h2>

            {orderSuccess && orderResult ? (
              <div className="order-success-full">
                <div className="order-success-banner">
                  <CheckCircle2 size={18} />
                  {locale.orderSuccess}
                </div>
                <p className="order-success-meta">
                  {locale.orderDate}: {orderResult.date} · Нарачка #{orderResult.id}
                </p>
              </div>
            ) : (
              <>
                {!authUser && <p className="cart-note">{locale.checkoutNote}</p>}

                {cartItems.length === 0 ? (
                  <div className="empty-state" style={{ border: 'none', padding: '32px 0' }}>
                    <ShoppingCart size={36} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
                    <p>{locale.emptyCart}</p>
                  </div>
                ) : (
                  <>
                    <div className="cart-list">
                      {cartItems.map(item => (
                        <div key={item.productId} className="cart-item">
                          {/* Info */}
                          <div>
                            <h3>{item.product.name[language]}</h3>
                            <p style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{item.product.sku}</p>
                            <p>{item.product.price.toFixed(2)} € / ед.</p>
                          </div>

                          {/* Qty stepper */}
                          <div className="cart-actions">
                            <div className="cart-qty">
                              <button type="button" className="cart-qty__btn"
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}>
                                <Minus size={12} />
                              </button>
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={e => updateQuantity(item.productId, Number(e.target.value))}
                              />
                              <button type="button" className="cart-qty__btn"
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}>
                                <Plus size={12} />
                              </button>
                            </div>
                            <button type="button" className="remove" onClick={() => removeFromCart(item.productId)}>
                              {locale.remove}
                            </button>
                          </div>

                          {/* Subtotal */}
                          <div className="cart-subtotal">{item.subtotal.toFixed(2)} €</div>
                        </div>
                      ))}
                    </div>

                    <div className="cart-footer">
                      <span>{locale.total}</span>
                      <strong>{totalPrice.toFixed(2)} €</strong>
                    </div>

                    <div className="cart-order-section">
                      <textarea
                        className="cart-note-input"
                        value={orderNote}
                        onChange={e => setOrderNote(e.target.value)}
                        placeholder={locale.orderNote}
                        rows={2}
                      />
                      <div className="cart-modal-actions">
                        <button type="button" className="btn-place-order" onClick={placeOrder}>
                          <Truck size={15} />
                          {locale.placeOrder}
                        </button>
                        <button type="button" className="btn-continue-order" onClick={() => setCartOpen(false)}>
                          {locale.continueOrder}
                        </button>
                      </div>
                      {!authUser && <p className="cart-login-hint">{locale.checkoutNote}</p>}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Product detail modal ── */}
      {selectedProduct && (
        <div className="product-modal-overlay" onMouseDown={() => setSelectedProduct(null)}>
          <div className="product-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedProduct(null)}><X size={14} /></button>

            {/* Image carousel */}
            {(() => {
              const imgs = selectedProduct.images?.length
                ? selectedProduct.images
                : [{ id: 0, url: selectedProduct.image_url || null }]
              const hasMany = imgs.length > 1
              const src = imgs[carouselIdx]?.url ?? null
              return (
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
              )
            })()}

            {/* Details */}
            <div className="modal-details">
              {/* Category breadcrumb */}
              <div className="product-category">
                {getCategoryChain(selectedProduct.category).map((name, i, arr) => (
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
      )}

      {/* ── Edit product modal (admin) ── */}
      {editModalOpen && editProduct && (
        <div className="product-modal-overlay" onMouseDown={() => { setEditModalOpen(false); setEditingProductId(null); setEditProduct(null) }}>
          <div className="edit-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setEditModalOpen(false); setEditingProductId(null); setEditProduct(null) }}>
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
                <button type="button" className="btn-cancel"
                  onClick={() => { setEditModalOpen(false); setEditingProductId(null); setEditProduct(null) }}>
                  Откажи
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Stock movement modal (Влез / Излез) ── */}
      {stockModal && (
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
      )}

      {/* ── Categories drawer (mobile) ── */}
      {categoriesOpen && (
        <div className="cat-drawer-overlay" onClick={() => setCategoriesOpen(false)}>
          <div className="cat-drawer" onClick={e => e.stopPropagation()}>
            <div className="cat-drawer__header">
              <span>Категории</span>
              <button type="button" className="cat-drawer__close" onClick={() => setCategoriesOpen(false)}><X size={16} /></button>
            </div>
            <nav className="cat-drawer__nav sidebar-list" onClick={() => setCategoriesOpen(false)}>
              <div className="sidebar-tree-node depth-0">
                <button
                  type="button"
                  className={selectedCategory === 'all' ? 'active' : ''}
                  onClick={() => setSelectedCategory('all')}
                >
                  <Tag size={13} />{locale.categoryAll}
                </button>
              </div>
              {renderSidebarTree(categoryTree)}
            </nav>
          </div>
        </div>
      )}

      {/* ── Bottom navigation (mobile ≤1024px) ── */}
      <nav className="bottom-nav" aria-label="Мобилна навигација" style={{ display: 'flex', position: 'fixed', bottom: 0, left: 0, right: 0, height: '58px', background: '#0B1C36', zIndex: 9999, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button
          type="button"
          className={`bottom-nav__tab${!categoriesOpen && !cartOpen && !authModal && !adminOpen ? ' active' : ''}`}
          onClick={() => { setSelectedCategory('all'); setCategoriesOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
        >
          <LayoutGrid size={22} />
          <span>Каталог</span>
        </button>
        <button
          type="button"
          className={`bottom-nav__tab${categoriesOpen ? ' active' : ''}`}
          onClick={() => { setCategoriesOpen(v => !v); setCartOpen(false) }}
        >
          <AlignJustify size={22} />
          <span>Категории</span>
        </button>
        {isAdmin ? (
          <button
            type="button"
            className={`bottom-nav__tab${adminOpen ? ' active' : ''}`}
            onClick={() => { setAdminOpen(v => !v); setCategoriesOpen(false) }}
          >
            <Settings size={22} />
            <span>Admin</span>
          </button>
        ) : (
          <button
            type="button"
            className={`bottom-nav__tab${cartOpen ? ' active' : ''}`}
            onClick={() => { setCartOpen(true); setCategoriesOpen(false) }}
          >
            <span className="bottom-nav__icon-wrap">
              <ShoppingCart size={22} />
              {totalCartQty > 0 && <span className="bottom-nav__badge">{totalCartQty}</span>}
            </span>
            <span>Кошничка</span>
          </button>
        )}
        <button
          type="button"
          className={`bottom-nav__tab${!!authModal ? ' active' : ''}`}
          onClick={() => {
            setCategoriesOpen(false)
            if (authUser) {
              if (isAdmin) logout()
              else { setMyOrdersOpen(true); loadMyOrders() }
            } else openAuthModal('login')
          }}
        >
          <User size={22} />
          <span>{authUser ? (isAdmin ? 'Одјави се' : 'Профил') : 'Пријави се'}</span>
        </button>
      </nav>

      {/* ── Stock history modal ── */}
      {stockHistory && (
        <div className="product-modal-overlay" onMouseDown={() => setStockHistory(null)}>
          <div className="stock-history-modal" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setStockHistory(null)}><X size={14} /></button>
            <div className="stock-history-modal__header">
              <History size={17} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{stockHistory.name[language]}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stockHistory.sku} · Тековно: <strong>{stockHistory.stock} ед.</strong></div>
              </div>
            </div>

            {stockHistoryData.length === 0 ? (
              <div className="empty-state" style={{ border: 'none', padding: '28px 0' }}>
                <Package size={32} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
                <p>Нема евиденција на движења.</p>
              </div>
            ) : (
              <div className="stock-history-list">
                {stockHistoryData.map(row => (
                  <div key={row.id} className={`stock-history-row stock-history-row--${row.type}`}>
                    <div className={`stock-history-type stock-history-type--${row.type}`}>
                      {row.type === 'in' ? <ArrowDownCircle size={14} /> : <ArrowUpCircle size={14} />}
                      {row.type === 'in' ? 'Влез' : 'Излез'}
                    </div>
                    <div className="stock-history-qty">
                      {row.type === 'in' ? '+' : '−'}{row.quantity} ед.
                    </div>
                    <div className="stock-history-date">{row.movement_date}</div>
                    <div className="stock-history-party">{row.party || '—'}</div>
                    {row.note && <div className="stock-history-note">{row.note}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
