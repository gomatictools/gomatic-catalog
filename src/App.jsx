import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Search, ShoppingCart, X, Package, CheckCircle2, XCircle,
  Settings, ClipboardList, ChevronRight, Truck, LogOut, User,
  Plus, Minus, Tag
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
    imageData: '',
  })
  const [newCategory, setNewCategory] = useState(emptyNewCategory())
  const [editingCategoryKey, setEditingCategoryKey] = useState(null)
  const [editCategory, setEditCategory] = useState({ name: { mk: '', sr: '', sq: '', en: '' }, parent_key: null })
  const [editingProductId, setEditingProductId] = useState(null)
  const [editProduct, setEditProduct] = useState(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const dragStateRef = useRef({ key: null, position: null })
  const dragProductRef = useRef({ id: null, position: 'after' })
  const [dropTarget, setDropTarget] = useState({ key: null, position: null })
  const [dropProductTarget, setDropProductTarget] = useState({ id: null, position: null })

  // ── Auth state ────────────────────────────────────────────────────────────────
  const [authUser, setAuthUser] = useState(null)
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token'))
  const [authModal, setAuthModal] = useState(null)
  const [authTab, setAuthTab] = useState('login')
  const [authForm, setAuthForm] = useState({ email: '', name: '', password: '', confirm_password: '', company_name: '', is_private: false })
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [orderNote, setOrderNote] = useState('')
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [orderResult, setOrderResult] = useState(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [myOrdersOpen, setMyOrdersOpen] = useState(false)
  const [myOrders, setMyOrders] = useState([])
  const [allOrdersOpen, setAllOrdersOpen] = useState(false)
  const [allOrders, setAllOrders] = useState([])

  const locale = translations[language]

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

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const openAuthModal = (tab = 'login') => {
    setAuthTab(tab)
    setAuthForm({ email: '', name: '', password: '', confirm_password: '', company_name: '', is_private: false })
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
        : { email: authForm.email, name: authForm.name, password: authForm.password, company_name: authForm.company_name, is_private: authForm.is_private }
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
      if (res.ok) setAllOrders(await res.json())
    } catch { /* silent */ }
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
    } catch {
      setError('Не може да се испрати нарачката.')
    }
  }

  // ── Product CRUD ──────────────────────────────────────────────────────────────
  const resetNewProduct = () =>
    setNewProduct({
      name: { mk: '', sr: '', sq: '', en: '' },
      description: { mk: '', sr: '', sq: '', en: '' },
      category: categoryList[0]?.key || '',
      price: '',
      sku: '',
      imageData: '',
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
      const payload = {
        sku: newProduct.sku || `P-${Date.now()}`,
        category: newProduct.category,
        price: Number(newProduct.price) || 0,
        name: newProduct.name,
        description: newProduct.description,
        imageData: newProduct.imageData,
      }
      const res = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
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
      imageData: '',
      image_url: product.image_url || '',
      stock: String(product.stock ?? 0),
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
        imageData: editProduct.imageData || undefined,
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

  // ── Derived data ──────────────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const descendantKeys = selectedCategory === 'all' ? null : getDescendantKeys(selectedCategory)
    return productList.filter(product => {
      if (descendantKeys && !descendantKeys.has(product.category)) return false
      if (!q) return true
      return `${product.name[language]} ${product.description[language]} ${product.sku}`.toLowerCase().includes(q)
    })
  }, [search, selectedCategory, language, productList, getDescendantKeys])

  const addToCart = (productId) => {
    if (!authUser) { openAuthModal('login'); return }
    setCart(cur => {
      const item = cur.find(e => e.productId === productId)
      if (item) return cur.map(e => e.productId === productId ? { ...e, quantity: e.quantity + 1 } : e)
      return [...cur, { productId, quantity: 1 }]
    })
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
    nodes.map(node => (
      <div key={node.key} className={`sidebar-tree-node depth-${depth}`}>
        <button
          type="button"
          className={selectedCategory === node.key ? 'active' : ''}
          onClick={() => setSelectedCategory(node.key)}
        >
          {node.name[language] || node.key}
        </button>
        {node.children?.length > 0 && (
          <div className="sidebar-tree-children">{renderSidebarTree(node.children, depth + 1)}</div>
        )}
      </div>
    ))

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
  const isInStock = (product) => (product.stock ?? 0) > 0

  const StockBadge = ({ product }) => {
    if (isInStock(product)) {
      return (
        <span className="stock-badge stock-badge--in">
          <CheckCircle2 size={9} strokeWidth={3} />
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
                {authUser.role === 'admin' ? (
                  <button type="button" className="btn-auth-outline" onClick={() => { setAllOrdersOpen(true); loadAllOrders() }}>
                    <ClipboardList size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    Сите нарачки
                  </button>
                ) : (
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
                <ShoppingCart size={15} />
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
          <div className="admin-tabs">
            {[
              { key: 'products',   label: 'Додавање производи' },
              { key: 'categories', label: 'Додавање категории' },
              { key: 'catalog',    label: 'Уредување на каталог' },
              { key: 'db',         label: 'Управување со база' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`admin-tab${adminTab === tab.key ? ' active' : ''}`}
                onClick={() => setAdminTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
                        <label>Слика</label>
                        <input type="file" accept="image/*" onChange={e => handleImageFile(e.target.files?.[0], setEditProduct)} />
                        {(editProduct.imageData || editProduct.image_url) && (
                          <img src={editProduct.imageData || editProduct.image_url} alt="preview" style={{ maxWidth: 160, marginTop: 8, borderRadius: 6 }} />
                        )}
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
                <div className="admin-grid">
                  {availableLanguages.map(lang => (
                    <div key={lang.code} className="admin-group">
                      <label>Назив ({lang.label})</label>
                      <input value={newProduct.name[lang.code]} onChange={e => handleNewProductChange(`name.${lang.code}`, e.target.value)} />
                      <label>Опис ({lang.label})</label>
                      <textarea value={newProduct.description[lang.code]} onChange={e => handleNewProductChange(`description.${lang.code}`, e.target.value)} />
                    </div>
                  ))}
                  <div className="admin-group">
                    <label>Категорија</label>
                    <select value={newProduct.category} onChange={e => handleNewProductChange('category', e.target.value)}>
                      {categoriesFlat.map(cat => (
                        <option key={cat.id} value={cat.id}>{'   '.repeat(cat.depth)}{cat.depth > 0 ? '└ ' : ''}{cat.label}</option>
                      ))}
                    </select>
                    <label>Цена</label>
                    <input value={newProduct.price} onChange={e => handleNewProductChange('price', e.target.value)} />
                    <label>SKU</label>
                    <input value={newProduct.sku} onChange={e => handleNewProductChange('sku', e.target.value)} />
                    <label>Слика</label>
                    <input type="file" accept="image/*" onChange={e => handleImageFile(e.target.files?.[0], setNewProduct)} />
                    {newProduct.imageData && <img src={newProduct.imageData} alt="preview" style={{ maxWidth: 160, marginTop: 8, borderRadius: 6 }} />}
                  </div>
                </div>
                <div className="admin-actions">
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
          </div>

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
              {filteredProducts.map(product => (
                <article
                  key={product.id}
                  className={`product-card${authUser?.role === 'admin' && adminOpen ? ' admin-draggable' : ''}${dropProductTarget.id === product.id ? ` drop-prod-${dropProductTarget.position}` : ''}`}
                  draggable={!!(authUser?.role === 'admin' && adminOpen)}
                  onDragStart={authUser?.role === 'admin' && adminOpen ? e => handleProdDragStart(e, product.id) : undefined}
                  onDragOver={authUser?.role === 'admin' && adminOpen ? e => handleProdDragOver(e, product.id) : undefined}
                  onDrop={authUser?.role === 'admin' && adminOpen ? e => handleProdDrop(e, product.id) : undefined}
                  onDragEnd={authUser?.role === 'admin' && adminOpen ? handleProdDragEnd : undefined}
                >
                  {/* Image */}
                  <div className="product-image product-image--clickable" onClick={() => setSelectedProduct(product)}>
                    <img
                      src={product.image_url || `https://via.placeholder.com/320x240/F7FAFC/A0AEC0?text=${encodeURIComponent(product.sku)}`}
                      alt={product.name[language]}
                    />
                    {!isInStock(product) && (
                      <div className="product-image__out-of-stock">Нема залиха</div>
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
                    <h2 className="product-name--clickable" onClick={() => setSelectedProduct(product)}>
                      {product.name[language]}
                    </h2>

                    {/* SKU + stock */}
                    <div className="product-meta-row">
                      <span className="product-sku">{product.sku}</span>
                      <StockBadge product={product} />
                    </div>

                    {/* Price */}
                    <div className="product-meta">
                      <strong className="product-price">{product.price.toFixed(2)} €</strong>
                    </div>

                    {/* Add to cart */}
                    <button
                      type="button"
                      onClick={() => addToCart(product.id)}
                      disabled={!isInStock(product)}
                    >
                      <ShoppingCart size={13} />
                      {locale.addToCart}
                    </button>

                    {/* Admin actions */}
                    {adminOpen && authUser?.role === 'admin' && (
                      <div className="product-admin-actions">
                        <button type="button" className="btn-edit-sm" onClick={() => startEditProduct(product)}>Уреди</button>
                        <button type="button" className="btn-delete-sm" onClick={() => deleteProduct(product.id)}>Избриши</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}

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
        <div className="product-modal-overlay" onClick={() => setAuthModal(null)}>
          <div className="auth-modal" onClick={e => e.stopPropagation()}>
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
              {authTab === 'register' && (
                <label>{locale.name}
                  <input type="text" required value={authForm.name} onChange={e => setAuthForm(p => ({ ...p, name: e.target.value }))} />
                </label>
              )}
              <label>{locale.email}
                <input type="email" required value={authForm.email} onChange={e => setAuthForm(p => ({ ...p, email: e.target.value }))} />
              </label>
              <label>{locale.password}
                <input type="password" required minLength={6} value={authForm.password} onChange={e => setAuthForm(p => ({ ...p, password: e.target.value }))} />
              </label>
              {authTab === 'register' && (
                <>
                  <label>Потврди лозинка
                    <input type="password" required minLength={6} value={authForm.confirm_password} onChange={e => setAuthForm(p => ({ ...p, confirm_password: e.target.value }))} />
                  </label>
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
        <div className="product-modal-overlay" onClick={() => setMyOrdersOpen(false)}>
          <div className="orders-modal" onClick={e => e.stopPropagation()}>
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

      {/* ── All orders modal (admin) ── */}
      {allOrdersOpen && (
        <div className="product-modal-overlay" onClick={() => setAllOrdersOpen(false)}>
          <div className="orders-modal orders-modal--wide" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAllOrdersOpen(false)}><X size={14} /></button>
            <h2><ClipboardList size={17} />Сите нарачки</h2>
            {allOrders.length === 0 ? (
              <div className="empty-state" style={{ border: 'none', padding: '32px 0' }}>
                <Package size={36} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
                <p>Нема нарачки.</p>
              </div>
            ) : (
              <div className="orders-list">
                {allOrders.map(order => (
                  <div key={order.id} className="order-card">
                    <div className="order-card-header">
                      <span>#{order.id}</span>
                      <span className="order-status">{order.status}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{new Date(order.created_at).toLocaleDateString()}</span>
                      <span className="order-user-tag">{order.user_name} · {order.email}</span>
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
        <div className="product-modal-overlay" onClick={() => setCartOpen(false)}>
          <div className="cart-modal" onClick={e => e.stopPropagation()}>
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
        <div className="product-modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="product-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedProduct(null)}><X size={14} /></button>

            {/* Image */}
            <div className="modal-image">
              <img
                src={selectedProduct.image_url || `https://via.placeholder.com/600x480/F7FAFC/A0AEC0?text=${encodeURIComponent(selectedProduct.sku)}`}
                alt={selectedProduct.name[language]}
              />
            </div>

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
                <div className="modal-specs__row">
                  <div className="modal-specs__label">На залиха</div>
                  <div className="modal-specs__value">
                    <StockBadge product={selectedProduct} />
                  </div>
                </div>
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
              <button
                type="button"
                disabled={!isInStock(selectedProduct)}
                onClick={() => { addToCart(selectedProduct.id); setSelectedProduct(null) }}
              >
                <ShoppingCart size={16} />
                {locale.addToCart}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit product modal (admin) ── */}
      {editModalOpen && editProduct && (
        <div className="product-modal-overlay" onClick={() => { setEditModalOpen(false); setEditingProductId(null); setEditProduct(null) }}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
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

                {/* Image preview */}
                <div className="edit-modal__image-box">
                  <img
                    src={editProduct.imageData || editProduct.image_url || `https://via.placeholder.com/280x200/F7FAFC/A0AEC0?text=${encodeURIComponent(editProduct.sku)}`}
                    alt="preview"
                  />
                  <label className="edit-modal__image-upload">
                    Промени слика
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      onChange={e => handleImageFile(e.target.files?.[0], setEditProduct)} />
                  </label>
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
    </div>
  )
}

export default App
