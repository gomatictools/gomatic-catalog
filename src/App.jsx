import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { translations } from './data'

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
  const [selectedProduct, setSelectedProduct] = useState(null)
  const dragStateRef = useRef({ key: null, position: null })
  const [dropTarget, setDropTarget] = useState({ key: null, position: null })

  const locale = translations[language]

  // Depth map: key → depth (0=root, 1=sub, 2=sub-sub)
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

  // Tree structure built from flat list
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

  // DFS-ordered flat list for dropdowns/pills (depth info included)
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

  // Returns Set of keys: the given key plus all descendants
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

  // Valid parents for "add category": max depth 2, so parent depth must be <= 1
  const validParentOptions = useMemo(
    () => categoriesFlat.filter(c => (catDepthMap[c.id] ?? 0) <= 1),
    [categoriesFlat, catDepthMap],
  )

  // Valid parents for "edit category": exclude self and descendants
  const editParentOptions = useMemo(() => {
    if (!editingCategoryKey) return validParentOptions
    const excluded = getDescendantKeys(editingCategoryKey)
    excluded.add(editingCategoryKey)
    return validParentOptions.filter(c => !excluded.has(c.id))
  }, [validParentOptions, editingCategoryKey, getDescendantKeys])

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCategoryList(data)
      setNewProduct(prev => ({ ...prev, category: prev.category || data[0]?.key || '' }))
    } catch {
      // silent fallback
    }
  }

  const loadProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/api/products`)
      if (!response.ok) throw new Error()
      setProductList(await response.json())
    } catch {
      setError('Не може да се вчитаат продуктите. Проверете дали backend серверот работи.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
    loadProducts()
  }, [])


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

  // ── Product CRUD ─────────────────────────────────────────────────────────────

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      await loadProducts()
      resetNewProduct()
    } catch {
      setError('Не може да се додаде производ. Проверете ги податоците.')
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
    })
    setAdminOpen(true)
    setTimeout(() => document.querySelector('.admin-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `Серверска грешка (${res.status})`)
      }
      await loadProducts()
      setEditingProductId(null)
      setEditProduct(null)
    } catch (err) {
      console.error('saveEditProduct error:', err)
      setError(err.message)
    }
  }

  const deleteProduct = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `Серверска грешка (${res.status})`)
      }
      await loadProducts()
      if (editingProductId === id) { setEditingProductId(null); setEditProduct(null) }
    } catch (err) {
      console.error('deleteProduct error:', err)
      setError(err.message)
    }
  }

  // ── Category CRUD ────────────────────────────────────────────────────────────

  const addCategory = async (ev) => {
    ev.preventDefault()
    const mkName = newCategory.name.mk.trim()
    if (!mkName) return
    const key = slugify(mkName)
    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCategory.name, parent_key: editCategory.parent_key || null }),
      })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || 'Грешка') }
      await loadCategories()
      setEditingCategoryKey(null)
    } catch (err) {
      console.error('saveCategory error:', err)
      setError(err.message || 'Не може да се зачува категоријата.')
    }
  }

  const deleteCategory = async (key) => {
    try {
      const res = await fetch(`${API_BASE}/api/categories/${encodeURIComponent(key)}`, { method: 'DELETE' })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || 'Грешка') }
      await loadCategories()
    } catch (err) {
      console.error('deleteCategory error:', err)
      setError(err.message || 'Не може да се избрише категоријата.')
    }
  }

  // ── Category drag-and-drop reorder ──────────────────────────────────────────

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
        headers: { 'Content-Type': 'application/json' },
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

  // ── Misc ─────────────────────────────────────────────────────────────────────

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

  // ── Derived data ─────────────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const descendantKeys = selectedCategory === 'all' ? null : getDescendantKeys(selectedCategory)
    return productList.filter(product => {
      if (descendantKeys && !descendantKeys.has(product.category)) return false
      if (!q) return true
      return `${product.name[language]} ${product.description[language]} ${product.sku}`.toLowerCase().includes(q)
    })
  }, [search, selectedCategory, language, productList, getDescendantKeys])

  const addToCart = (productId) =>
    setCart(cur => {
      const item = cur.find(e => e.productId === productId)
      if (item) return cur.map(e => e.productId === productId ? { ...e, quantity: e.quantity + 1 } : e)
      return [...cur, { productId, quantity: 1 }]
    })

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

  // ── Render helpers ───────────────────────────────────────────────────────────

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
                  <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.label}</option>
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

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className="catalog-app">
      <header className="catalog-header">
        <div>
          <h1>{locale.title}</h1>
          <p>{locale.subtitle}</p>
        </div>
        <label className="language-select">
          <span>{locale.languageLabel}</span>
          <select value={language} onChange={e => setLanguage(e.target.value)}>
            {availableLanguages.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.label}</option>
            ))}
          </select>
        </label>
        <button type="button" className="admin-toggle" onClick={() => setAdminOpen(v => !v)}>
          {adminOpen ? 'Close admin' : 'Admin'}
        </button>
      </header>

      {adminOpen && (
        <section className="admin-panel">
          <h2>Admin — Управување со каталог</h2>

          {/* ── Category management ── */}
          <div className="admin-section">
            <h3>Категории</h3>
            <div className="category-manager">
              <div className="category-admin-tree">
                {renderCategoryAdminTree(categoryTree)}
                {categoryTree.length === 0 && <p className="empty-hint">Нема додадени категории.</p>}
              </div>

              <form onSubmit={addCategory} className="category-add-form">
                <h4>Додај категорија</h4>
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
                        <option key={c.id} value={c.id}>{'  '.repeat(c.depth)}{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="category-add-btn">+ Додај категорија</button>
              </form>
            </div>
          </div>

          {/* ── Product add / edit ── */}
          {editingProductId !== null && editProduct ? (
            <div className="admin-section admin-section--edit">
              <h3>Уреди производ — {editProduct.sku}</h3>
              <form onSubmit={saveEditProduct} className="admin-form">
                <div className="admin-grid">
                  {availableLanguages.map(lang => (
                    <div key={lang.code} className="admin-group">
                      <label>Назив ({lang.label})</label>
                      <input
                        value={editProduct.name[lang.code]}
                        onChange={e => handleEditProductChange(`name.${lang.code}`, e.target.value)}
                      />
                      <label>Опис ({lang.label})</label>
                      <textarea
                        value={editProduct.description[lang.code]}
                        onChange={e => handleEditProductChange(`description.${lang.code}`, e.target.value)}
                      />
                    </div>
                  ))}
                  <div className="admin-group">
                    <label>Категорија</label>
                    <select value={editProduct.category} onChange={e => handleEditProductChange('category', e.target.value)}>
                      {categoriesFlat.map(cat => (
                        <option key={cat.id} value={cat.id}>{'  '.repeat(cat.depth)}{cat.label}</option>
                      ))}
                    </select>
                    <label>Цена</label>
                    <input value={editProduct.price} onChange={e => handleEditProductChange('price', e.target.value)} />
                    <label>SKU</label>
                    <input value={editProduct.sku} onChange={e => handleEditProductChange('sku', e.target.value)} />
                    <label>Слика</label>
                    <input type="file" accept="image/*" onChange={e => handleImageFile(e.target.files?.[0], setEditProduct)} />
                    {(editProduct.imageData || editProduct.image_url) && (
                      <img src={editProduct.imageData || editProduct.image_url} alt="preview" style={{ maxWidth: 160, marginTop: 8 }} />
                    )}
                  </div>
                </div>
                <div className="admin-actions">
                  <button type="submit" className="btn-save">Зачувај промени</button>
                  <button type="button" className="btn-cancel" onClick={() => { setEditingProductId(null); setEditProduct(null) }}>Откажи</button>
                </div>
              </form>
            </div>
          ) : (
            <div className="admin-section">
              <h3>Додај нов производ</h3>
              <form onSubmit={addProduct} className="admin-form">
                <div className="admin-grid">
                  {availableLanguages.map(lang => (
                    <div key={lang.code} className="admin-group">
                      <label>Назив ({lang.label})</label>
                      <input
                        value={newProduct.name[lang.code]}
                        onChange={e => handleNewProductChange(`name.${lang.code}`, e.target.value)}
                      />
                      <label>Опис ({lang.label})</label>
                      <textarea
                        value={newProduct.description[lang.code]}
                        onChange={e => handleNewProductChange(`description.${lang.code}`, e.target.value)}
                      />
                    </div>
                  ))}
                  <div className="admin-group">
                    <label>Категорија</label>
                    <select value={newProduct.category} onChange={e => handleNewProductChange('category', e.target.value)}>
                      {categoriesFlat.map(cat => (
                        <option key={cat.id} value={cat.id}>{'  '.repeat(cat.depth)}{cat.label}</option>
                      ))}
                    </select>
                    <label>Цена</label>
                    <input value={newProduct.price} onChange={e => handleNewProductChange('price', e.target.value)} />
                    <label>SKU</label>
                    <input value={newProduct.sku} onChange={e => handleNewProductChange('sku', e.target.value)} />
                    <label>Слика</label>
                    <input type="file" accept="image/*" onChange={e => handleImageFile(e.target.files?.[0], setNewProduct)} />
                    {newProduct.imageData && <img src={newProduct.imageData} alt="preview" style={{ maxWidth: 160, marginTop: 8 }} />}
                  </div>
                </div>
                <div className="admin-actions">
                  <button type="submit">Додај производ</button>
                  <button type="button" onClick={exportProducts}>Export JSON</button>
                  <label className="import-file">
                    Import JSON
                    <input type="file" accept="application/json" style={{ display: 'none' }} onChange={e => importProductsFromFile(e.target.files?.[0])} />
                  </label>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {error && (
        <div className="error-banner" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>
          {error} ✕
        </div>
      )}

      <main className="catalog-main">
        {/* ── Sidebar ── */}
        <aside className="sidebar-categories" aria-label="Categories">
          <div className="sidebar-card">
            <h3>{locale.categoryAll}</h3>
            <nav className="sidebar-list">
              <div className="sidebar-tree-node depth-0">
                <button
                  type="button"
                  className={selectedCategory === 'all' ? 'active' : ''}
                  onClick={() => setSelectedCategory('all')}
                >
                  {locale.categoryAll}
                </button>
              </div>
              {renderSidebarTree(categoryTree)}
            </nav>
          </div>
        </aside>

        {/* ── Products ── */}
        <section className="product-panel">
          <div className="catalog-controls">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={locale.searchPlaceholder}
            />
          </div>

          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map(product => (
                <article key={product.id} className="product-card">
                  <div className="product-image product-image--clickable" onClick={() => setSelectedProduct(product)}>
                    <img
                      src={product.image_url || `https://via.placeholder.com/320x220?text=${encodeURIComponent(product.name[language])}`}
                      alt={product.name[language]}
                    />
                  </div>
                  <div className="product-details">
                    <span className="product-category">{getCategoryName(product.category)}</span>
                    <h2 className="product-name--clickable" onClick={() => setSelectedProduct(product)}>{product.name[language]}</h2>
                    <div className="product-meta">
                      <span>{locale.productCode}: {product.sku}</span>
                      <strong>{product.price.toFixed(2)} €</strong>
                    </div>
                    <button type="button" onClick={() => addToCart(product.id)}>
                      {locale.addToCart}
                    </button>
                    {adminOpen && (
                      <div className="product-admin-actions">
                        <button type="button" className="btn-edit-sm" onClick={() => startEditProduct(product)}>Уреди</button>
                        <button type="button" className="btn-delete-sm" onClick={() => deleteProduct(product.id)}>Избриши</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
              {filteredProducts.length === 0 && <div className="empty-state">{locale.noProducts}</div>}
            </div>
          )}
        </section>

        {/* ── Cart ── */}
        <aside className="cart-panel">
          <div className="cart-card">
            <h2>{locale.cartTitle}</h2>
            <p className="cart-note">{locale.checkoutNote}</p>
            {cartItems.length === 0 ? (
              <div className="empty-state">{locale.emptyCart}</div>
            ) : (
              <div className="cart-list">
                {cartItems.map(item => (
                  <div key={item.productId} className="cart-item">
                    <div>
                      <h3>{item.product.name[language]}</h3>
                      <p>{item.product.price.toFixed(2)} € × {item.quantity}</p>
                      <p>{locale.productCode}: {item.product.sku}</p>
                    </div>
                    <div className="cart-actions">
                      <label>
                        {locale.quantity}
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => updateQuantity(item.productId, Number(e.target.value))}
                        />
                      </label>
                      <button type="button" className="remove" onClick={() => removeFromCart(item.productId)}>
                        {locale.remove}
                      </button>
                    </div>
                    <div className="cart-subtotal">{item.subtotal.toFixed(2)} €</div>
                  </div>
                ))}
              </div>
            )}
            <div className="cart-footer">
              <span>{locale.total}</span>
              <strong>{totalPrice.toFixed(2)} €</strong>
            </div>
          </div>
        </aside>
      </main>

      {selectedProduct && (
        <div className="product-modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="product-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedProduct(null)}>✕</button>
            <div className="modal-image">
              <img
                src={selectedProduct.image_url || `https://via.placeholder.com/600x400?text=${encodeURIComponent(selectedProduct.name[language])}`}
                alt={selectedProduct.name[language]}
              />
            </div>
            <div className="modal-details">
              <span className="product-category">{getCategoryName(selectedProduct.category)}</span>
              <h2>{selectedProduct.name[language]}</h2>
              <p>{selectedProduct.description[language]}</p>
              <div className="product-meta">
                <span>{locale.productCode}: {selectedProduct.sku}</span>
                <strong>{selectedProduct.price.toFixed(2)} €</strong>
              </div>
              <button type="button" onClick={() => { addToCart(selectedProduct.id); setSelectedProduct(null) }}>
                {locale.addToCart}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
