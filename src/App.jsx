import { useCallback, useEffect, useMemo, useState } from 'react'
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

const emptyNewCategory = () => ({ name: { mk: '', sr: '', sq: '', en: '' } })

function App() {
  const [language, setLanguage] = useState('mk')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
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
  const [editCategory, setEditCategory] = useState({ name: { mk: '', sr: '', sq: '', en: '' } })
  const [editingProductId, setEditingProductId] = useState(null)
  const [editProduct, setEditProduct] = useState(null)

  const locale = translations[language]

  const categories = useMemo(
    () => [
      { id: 'all', label: locale.categoryAll },
      ...categoryList.map(cat => ({ id: cat.key, label: cat.name[language] || cat.key })),
    ],
    [categoryList, language, locale.categoryAll],
  )

  const getCategoryName = useCallback(
    (key) => {
      const cat = categoryList.find(c => c.key === key)
      return cat ? (cat.name[language] || key) : key
    },
    [categoryList, language],
  )

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCategoryList(data)
      setNewProduct(prev => ({ ...prev, category: prev.category || data[0]?.key || '' }))
    } catch {
      // categories silently fall back to empty
    }
  }

  const loadProducts = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/api/products`)
      if (!response.ok) {
        throw new Error('Unable to load products')
      }
      const data = await response.json()
      setProductList(data)
    } catch (err) {
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

  const handleImageFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setNewProduct((prev) => ({ ...prev, imageData: e.target.result }))
    reader.readAsDataURL(file)
  }

  const handleNewProductChange = (path, value) => {
    if (path.startsWith('name.') || path.startsWith('description.')) {
      const [key, sub] = path.split('.')
      setNewProduct((prev) => ({ ...prev, [key]: { ...prev[key], [sub]: value } }))
      return
    }
    setNewProduct((prev) => ({ ...prev, [path]: value }))
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
      const response = await fetch(`${API_BASE}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw new Error('Unable to save product')
      }
      await loadProducts()
      resetNewProduct()
    } catch (err) {
      setError('Не може да се додаде производ. Проверете ги податоците.')
    }
  }

  const addCategory = async (ev) => {
    ev.preventDefault()
    const mkName = newCategory.name.mk.trim()
    if (!mkName) return
    const key = slugify(mkName)
    try {
      const res = await fetch(`${API_BASE}/api/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, name: newCategory.name }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Грешка')
      }
      await loadCategories()
      setNewCategory(emptyNewCategory())
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteCategory = async (key) => {
    try {
      const res = await fetch(`${API_BASE}/api/categories/${encodeURIComponent(key)}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Грешка')
      }
      await loadCategories()
    } catch (err) {
      setError(err.message)
    }
  }

  const startEditCategory = (cat) => {
    setEditingCategoryKey(cat.key)
    setEditCategory({ name: { ...cat.name } })
  }

  const saveCategory = async (ev) => {
    ev.preventDefault()
    if (!editCategory.name.mk.trim()) return
    try {
      const res = await fetch(`${API_BASE}/api/categories/${encodeURIComponent(editingCategoryKey)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCategory.name }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Грешка')
      }
      await loadCategories()
      setEditingCategoryKey(null)
    } catch (err) {
      setError(err.message)
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

  const handleEditProductChange = (path, value) => {
    if (path.startsWith('name.') || path.startsWith('description.')) {
      const [key, sub] = path.split('.')
      setEditProduct((prev) => ({ ...prev, [key]: { ...prev[key], [sub]: value } }))
      return
    }
    setEditProduct((prev) => ({ ...prev, [path]: value }))
  }

  const handleEditImageFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => setEditProduct((prev) => ({ ...prev, imageData: e.target.result }))
    reader.readAsDataURL(file)
  }

  const saveEditProduct = async (ev) => {
    ev.preventDefault()
    try {
      const payload = {
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
      if (!res.ok) throw new Error('Unable to save product')
      await loadProducts()
      setEditingProductId(null)
      setEditProduct(null)
    } catch (err) {
      setError('Не може да се зачува производот.')
    }
  }

  const deleteProduct = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Unable to delete product')
      await loadProducts()
      if (editingProductId === id) {
        setEditingProductId(null)
        setEditProduct(null)
      }
    } catch (err) {
      setError('Не може да се избрише производот.')
    }
  }

  const exportProducts = () => {
    const blob = new Blob([JSON.stringify(productList, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'products.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const importProductsFromFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result)
        if (Array.isArray(parsed)) {
          setProductList(parsed)
        }
      } catch (err) {
        setError('Некоректен JSON датотека.')
      }
    }
    reader.readAsText(file)
  }

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return productList.filter((product) => {
      if (category !== 'all' && product.category !== category) {
        return false
      }
      if (!normalizedSearch) {
        return true
      }
      const fullText = `${product.name[language]} ${product.description[language]} ${product.sku}`.toLowerCase()
      return fullText.includes(normalizedSearch)
    })
  }, [search, category, language, productList])

  const addToCart = (productId) => {
    setCart((current) => {
      const item = current.find((entry) => entry.productId === productId)
      if (item) {
        return current.map((entry) =>
          entry.productId === productId
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry,
        )
      }
      return [...current, { productId, quantity: 1 }]
    })
  }

  const removeFromCart = (productId) => {
    setCart((current) => current.filter((entry) => entry.productId !== productId))
  }

  const updateQuantity = (productId, quantity) => {
    setCart((current) =>
      current
        .map((entry) =>
          entry.productId === productId
            ? { ...entry, quantity: Math.max(1, quantity) }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    )
  }

  const cartItems = cart
    .map((entry) => {
      const product = productList.find((item) => item.id === entry.productId)
      if (!product) return null
      return {
        ...entry,
        product,
        subtotal: product.price * entry.quantity,
      }
    })
    .filter(Boolean)

  const totalPrice = cartItems.reduce((sum, item) => sum + item.subtotal, 0)

  return (
    <div className="catalog-app">
      <header className="catalog-header">
        <div>
          <h1>{locale.title}</h1>
          <p>{locale.subtitle}</p>
        </div>
        <label className="language-select">
          <span>{locale.languageLabel}</span>
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            {availableLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="admin-toggle" onClick={() => setAdminOpen((value) => !value)}>
          {adminOpen ? 'Close admin' : 'Admin'}
        </button>
      </header>

      {adminOpen && (
        <section className="admin-panel">
          <h2>Admin — Управување со каталог</h2>

          <div className="admin-section">
            <h3>Категории</h3>
            <div className="category-manager">
              <ul className="category-list">
                {categoryList.map((cat) => (
                  <li key={cat.key} className="category-item">
                    {editingCategoryKey === cat.key ? (
                      <form onSubmit={saveCategory} className="category-edit-inline">
                        {availableLanguages.map((lang) => (
                          <div key={lang.code} className="admin-group">
                            <label>{lang.label}</label>
                            <input
                              value={editCategory.name[lang.code]}
                              onChange={(e) => setEditCategory(prev => ({ ...prev, name: { ...prev.name, [lang.code]: e.target.value } }))}
                              required={lang.code === 'mk'}
                            />
                          </div>
                        ))}
                        <div className="category-edit-actions">
                          <button type="submit" className="btn-save">Зачувај</button>
                          <button type="button" className="btn-cancel" onClick={() => setEditingCategoryKey(null)}>Откажи</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <span className="category-item-name">{cat.name.mk}</span>
                        <span className="category-item-langs">
                          {cat.name.sr} / {cat.name.sq} / {cat.name.en}
                        </span>
                        <button type="button" className="btn-edit-sm" onClick={() => startEditCategory(cat)}>Уреди</button>
                        <button type="button" className="category-delete" onClick={() => deleteCategory(cat.key)} title="Избриши">✕</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              <form onSubmit={addCategory} className="category-add-form">
                <div className="category-add-grid">
                  {availableLanguages.map((lang) => (
                    <div key={lang.code} className="admin-group">
                      <label>Назив ({lang.label})</label>
                      <input
                        value={newCategory.name[lang.code]}
                        onChange={(e) => setNewCategory(prev => ({ ...prev, name: { ...prev.name, [lang.code]: e.target.value } }))}
                        required={lang.code === 'mk'}
                        placeholder={lang.code === 'mk' ? 'Задолжително' : 'Незадолжително'}
                      />
                    </div>
                  ))}
                </div>
                <button type="submit" className="category-add-btn">+ Додај категорија</button>
              </form>
            </div>
          </div>

          {editingProductId !== null && editProduct ? (
            <div className="admin-section admin-section--edit">
              <h3>Уреди производ — {editProduct.sku}</h3>
              <form onSubmit={saveEditProduct} className="admin-form">
                <div className="admin-grid">
                  {availableLanguages.map((lang) => (
                    <div key={lang.code} className="admin-group">
                      <label>Назив ({lang.label})</label>
                      <input
                        value={editProduct.name[lang.code]}
                        onChange={(e) => handleEditProductChange(`name.${lang.code}`, e.target.value)}
                      />
                      <label>Опис ({lang.label})</label>
                      <textarea
                        value={editProduct.description[lang.code]}
                        onChange={(e) => handleEditProductChange(`description.${lang.code}`, e.target.value)}
                      />
                    </div>
                  ))}
                  <div className="admin-group">
                    <label>Категорија</label>
                    <select value={editProduct.category} onChange={(e) => handleEditProductChange('category', e.target.value)}>
                      {categoryList.map((cat) => (
                        <option key={cat.key} value={cat.key}>{cat.name.mk}</option>
                      ))}
                    </select>
                    <label>Цена</label>
                    <input value={editProduct.price} onChange={(e) => handleEditProductChange('price', e.target.value)} />
                    <label>SKU</label>
                    <input value={editProduct.sku} readOnly style={{ opacity: 0.6 }} />
                    <label>Слика</label>
                    <input type="file" accept="image/*" onChange={(e) => handleEditImageFile(e.target.files?.[0])} />
                    {(editProduct.imageData || editProduct.image_url) && (
                      <img
                        src={editProduct.imageData || editProduct.image_url}
                        alt="preview"
                        style={{ maxWidth: 160, marginTop: 8 }}
                      />
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
                  {availableLanguages.map((lang) => (
                    <div key={lang.code} className="admin-group">
                      <label>Назив ({lang.label})</label>
                      <input
                        value={newProduct.name[lang.code]}
                        onChange={(e) => handleNewProductChange(`name.${lang.code}`, e.target.value)}
                      />
                      <label>Опис ({lang.label})</label>
                      <textarea
                        value={newProduct.description[lang.code]}
                        onChange={(e) => handleNewProductChange(`description.${lang.code}`, e.target.value)}
                      />
                    </div>
                  ))}
                  <div className="admin-group">
                    <label>Категорија</label>
                    <select value={newProduct.category} onChange={(e) => handleNewProductChange('category', e.target.value)}>
                      {categoryList.map((cat) => (
                        <option key={cat.key} value={cat.key}>{cat.name.mk}</option>
                      ))}
                    </select>
                    <label>Цена</label>
                    <input value={newProduct.price} onChange={(e) => handleNewProductChange('price', e.target.value)} />
                    <label>SKU</label>
                    <input value={newProduct.sku} onChange={(e) => handleNewProductChange('sku', e.target.value)} />
                    <label>Слика</label>
                    <input type="file" accept="image/*" onChange={(e) => handleImageFile(e.target.files?.[0])} />
                    {newProduct.imageData && <img src={newProduct.imageData} alt="preview" style={{ maxWidth: 160, marginTop: 8 }} />}
                  </div>
                </div>
                <div className="admin-actions">
                  <button type="submit">Додај производ</button>
                  <button type="button" onClick={exportProducts}>Export JSON</button>
                  <label className="import-file">
                    Import JSON
                    <input
                      type="file"
                      accept="application/json"
                      style={{ display: 'none' }}
                      onChange={(e) => importProductsFromFile(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {error && <div className="error-banner">{error}</div>}

      <main className="catalog-main">
        <aside className="sidebar-categories" aria-label="Categories">
          <div className="sidebar-card">
            <h3>{locale.categoryAll}</h3>
            <nav className="sidebar-list">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={category === cat.id ? 'active' : ''}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <section className="product-panel">
          <div className="catalog-controls">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={locale.searchPlaceholder}
            />
            <div className="category-buttons">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={category === cat.id ? 'active' : ''}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article key={product.id} className="product-card">
                  <div className="product-image">
                    <img
                      src={product.image_url ? product.image_url : `https://via.placeholder.com/320x220?text=${encodeURIComponent(product.name[language])}`}
                      alt={product.name[language]}
                    />
                  </div>
                  <div className="product-details">
                    <span className="product-category">{getCategoryName(product.category)}</span>
                    <h2>{product.name[language]}</h2>
                    <p>{product.description[language]}</p>
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
              {filteredProducts.length === 0 && (
                <div className="empty-state">{locale.noProducts}</div>
              )}
            </div>
          )}
        </section>

        <aside className="cart-panel">
          <div className="cart-card">
            <h2>{locale.cartTitle}</h2>
            <p className="cart-note">{locale.checkoutNote}</p>
            {cartItems.length === 0 ? (
              <div className="empty-state">{locale.emptyCart}</div>
            ) : (
              <div className="cart-list">
                {cartItems.map((item) => (
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
                          onChange={(event) => updateQuantity(item.productId, Number(event.target.value))}
                        />
                      </label>
                      <button type="button" className="remove" onClick={() => removeFromCart(item.productId)}>
                        {locale.remove}
                      </button>
                    </div>
                    <div className="cart-subtotal">
                      {item.subtotal.toFixed(2)} €
                    </div>
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
    </div>
  )
}

export default App
