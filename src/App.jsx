import { useEffect, useMemo, useState } from 'react'
import { Package, X } from 'lucide-react'
import './App.css'
import { translations } from './data'

// Hooks
import { useAuth } from './hooks/useAuth'
import { useCategories } from './hooks/useCategories'
import { useProducts } from './hooks/useProducts'
import { useOrders } from './hooks/useOrders'
import { useUsers } from './hooks/useUsers'
import { useCart } from './hooks/useCart'
import { useStock } from './hooks/useStock'

// Components
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { ProductCard } from './components/ProductCard'
import { BottomNav } from './components/BottomNav'
import { CategoryDrawer } from './components/CategoryDrawer'
import { AdminPanel } from './components/admin/AdminPanel'

// Modals
import { AuthModal } from './components/modals/AuthModal'
import { MyOrdersModal } from './components/modals/MyOrdersModal'
import { CartModal } from './components/modals/CartModal'
import { ProductDetailModal } from './components/modals/ProductDetailModal'
import { EditProductModal } from './components/modals/EditProductModal'
import { StockModal } from './components/modals/StockModal'
import { StockHistoryModal } from './components/modals/StockHistoryModal'

function App() {
  const [language, setLanguage] = useState('mk')
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [adminOpen, setAdminOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [expandedRoot, setExpandedRoot] = useState(null)
  const [categoriesOpen, setCategoriesOpen] = useState(false)
  const [error, setError] = useState(null)

  const locale = translations[language]

  // ── Hooks ──────────────────────────────────────────────────────────────────────
  const auth = useAuth({ setError })
  const { authUser, authToken, isAdmin, openAuthModal, logout } = auth

  const categories = useCategories({ setError, language })
  const {
    categoryTree, categoriesFlat, getDescendantKeys, getCategoryChain,
    newCategory, setNewCategory, validParentOptions,
    editingCategoryKey, setEditingCategoryKey, editCategory, setEditCategory,
    editParentOptions, dropTarget,
    loadCategories, addCategory, startEditCategory, saveCategory, deleteCategory,
    handleCatDragStart, handleCatDragOver, handleCatDrop, handleCatDragEnd,
  } = categories

  const products = useProducts({ setError, authToken })
  const {
    productList, loading,
    newProduct, setNewProduct,
    editingProductId, setEditingProductId,
    editProduct, setEditProduct,
    editModalOpen, setEditModalOpen,
    dropProductTarget,
    adminStockFilter, setAdminStockFilter,
    fulfilledIds, setFulfilledIds,
    manualOrderedIds,
    isInStock, isCriticalStock,
    loadProducts, resetNewProduct,
    handleNewProductChange, handleEditProductChange,
    addProduct, startEditProduct, saveEditProduct,
    deleteEditImage, setPrimaryEditImage,
    handleImgDragStart, handleImgDrop,
    handleProdDragStart, handleProdDragOver, handleProdDrop, handleProdDragEnd,
    deleteProduct, exportProducts, importProductsFromFile, toggleManualOrdered,
  } = products

  const orders = useOrders({ setError, authToken, authUser, isAdmin })
  const {
    allOrders, myOrders,
    myOrdersOpen, setMyOrdersOpen,
    orderEdits, setOrderEdits,
    orderFilterDateFrom, setOrderFilterDateFrom,
    orderFilterDateTo, setOrderFilterDateTo,
    orderFilterStatus, setOrderFilterStatus,
    orderFilterPayment, setOrderFilterPayment,
    orderFilterUser, setOrderFilterUser,
    filteredOrders, orderedProductIds,
    loadMyOrders, loadAllOrders,
    saveOrder, deleteOrder,
    getOrderField, setOrderEdit,
  } = orders

  const users = useUsers({ setError, authToken, isAdmin })
  const {
    usersList, userEdits, setUserEdits, userSearch, setUserSearch,
    loadUsers, getUserField, setUserEdit, saveUser, deleteUser,
  } = users

  const cart = useCart({ authUser, authToken, productList, language, loadProducts, setError, openAuthModal })
  const {
    cartOpen, setCartOpen, cartAnimKey, flashProductId,
    cardQuantities, setCardQuantities,
    orderNote, setOrderNote, orderSuccess, orderResult,
    cartItems, totalPrice, totalCartQty,
    addToCart, removeFromCart, updateQuantity, placeOrder,
  } = cart

  const stock = useStock({ setError, authToken, loadProducts })
  const {
    stockModal, setStockModal,
    stockForm, setStockForm,
    stockHistory, setStockHistory, stockHistoryData,
    openStockModal, openStockHistory,
  } = stock

  // ── Cross-hook derived state ───────────────────────────────────────────────────
  const pendingOrderProductIds = useMemo(() => {
    const ids = new Set()
    orderedProductIds.forEach(id => { if (!fulfilledIds.has(id)) ids.add(id) })
    manualOrderedIds.forEach(id => { if (!fulfilledIds.has(id)) ids.add(id) })
    return ids
  }, [orderedProductIds, manualOrderedIds, fulfilledIds])

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
  }, [search, selectedCategory, language, productList, getDescendantKeys, adminStockFilter, pendingOrderProductIds])

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadCategories().then(data => {
      // Sync first category into newProduct default (mirrors original behavior)
      if (data?.length) {
        setNewProduct(prev => ({ ...prev, category: prev.category || data[0].key || '' }))
      }
    })
    loadProducts()
  }, [])

  useEffect(() => {
    if (authUser?.role === 'admin') setAdminOpen(true)
  }, [authUser])

  // ── submitStockMovement wrapper (needs cross-hook state) ──────────────────────
  const submitStockMovement = (ev) =>
    stock.submitStockMovement(ev, pendingOrderProductIds, setFulfilledIds)

  // ── logout wrapper (needs setMyOrdersOpen) ────────────────────────────────────
  const handleLogout = () => logout(() => setMyOrdersOpen(false))

  // ── JSX ───────────────────────────────────────────────────────────────────────
  return (
    <div className="catalog-app">

      <Header
        language={language}
        setLanguage={setLanguage}
        search={search}
        setSearch={setSearch}
        locale={locale}
        authUser={authUser}
        isAdmin={isAdmin}
        adminOpen={adminOpen}
        totalCartQty={totalCartQty}
        cartAnimKey={cartAnimKey}
        onOpenAuthModal={openAuthModal}
        onLogout={handleLogout}
        onOpenMyOrders={() => { setMyOrdersOpen(true); loadMyOrders() }}
        onOpenCart={() => setCartOpen(true)}
        onToggleAdmin={() => setAdminOpen(v => !v)}
      />

      {adminOpen && isAdmin && (
        <AdminPanel
          authUser={authUser}
          authToken={authToken}
          newProduct={newProduct}
          setNewProduct={setNewProduct}
          categoriesFlat={categoriesFlat}
          handleNewProductChange={handleNewProductChange}
          addProduct={addProduct}
          editingProductId={editingProductId}
          setEditingProductId={setEditingProductId}
          editProduct={editProduct}
          setEditProduct={setEditProduct}
          saveEditProduct={saveEditProduct}
          handleEditProductChange={handleEditProductChange}
          newCategory={newCategory}
          setNewCategory={setNewCategory}
          validParentOptions={validParentOptions}
          addCategory={addCategory}
          editingCategoryKey={editingCategoryKey}
          setEditingCategoryKey={setEditingCategoryKey}
          editCategory={editCategory}
          setEditCategory={setEditCategory}
          editParentOptions={editParentOptions}
          categoryTree={categoryTree}
          dropTarget={dropTarget}
          saveCategory={saveCategory}
          startEditCategory={startEditCategory}
          deleteCategory={deleteCategory}
          handleCatDragStart={handleCatDragStart}
          handleCatDragOver={handleCatDragOver}
          handleCatDrop={handleCatDrop}
          handleCatDragEnd={handleCatDragEnd}
          allOrders={allOrders}
          filteredOrders={filteredOrders}
          orderEdits={orderEdits}
          setOrderEdits={setOrderEdits}
          orderFilterUser={orderFilterUser}
          setOrderFilterUser={setOrderFilterUser}
          orderFilterStatus={orderFilterStatus}
          setOrderFilterStatus={setOrderFilterStatus}
          orderFilterPayment={orderFilterPayment}
          setOrderFilterPayment={setOrderFilterPayment}
          orderFilterDateFrom={orderFilterDateFrom}
          setOrderFilterDateFrom={setOrderFilterDateFrom}
          orderFilterDateTo={orderFilterDateTo}
          setOrderFilterDateTo={setOrderFilterDateTo}
          getOrderField={getOrderField}
          setOrderEdit={setOrderEdit}
          saveOrder={saveOrder}
          deleteOrder={deleteOrder}
          loadAllOrders={loadAllOrders}
          usersList={usersList}
          userEdits={userEdits}
          setUserEdits={setUserEdits}
          userSearch={userSearch}
          setUserSearch={setUserSearch}
          getUserField={getUserField}
          setUserEdit={setUserEdit}
          saveUser={saveUser}
          deleteUser={deleteUser}
          loadUsers={loadUsers}
          exportProducts={exportProducts}
          importProductsFromFile={importProductsFromFile}
        />
      )}

      {/* Error banner */}
      {error && (
        <div className="error-banner" onClick={() => setError(null)} style={{ cursor: 'pointer' }}>
          <X size={14} />
          {error}
        </div>
      )}

      {/* Main content */}
      <main className="catalog-main">

        <Sidebar
          categoryTree={categoryTree}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          language={language}
          locale={locale}
          expandedRoot={expandedRoot}
          setExpandedRoot={setExpandedRoot}
        />

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

          {/* Mobile category chips */}
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
                const isCritical = isAdmin && adminOpen && isCriticalStock(product)
                const isOrdered = isAdmin && adminOpen && pendingOrderProductIds.has(product.id)
                const cardQty = cardQuantities[product.id] ?? 1
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    isAdmin={isAdmin}
                    adminOpen={adminOpen}
                    isCritical={isCritical}
                    isOrdered={isOrdered}
                    dropProductTarget={dropProductTarget}
                    flashProductId={flashProductId}
                    cardQty={cardQty}
                    locale={locale}
                    language={language}
                    getCategoryChain={getCategoryChain}
                    isInStock={isInStock}
                    onOpenDetail={setSelectedProduct}
                    onAddToCart={addToCart}
                    onSetCardQty={(id, qty) => setCardQuantities(prev => ({ ...prev, [id]: qty }))}
                    onOpenStockModal={openStockModal}
                    onOpenStockHistory={openStockHistory}
                    onStartEdit={startEditProduct}
                    onDelete={deleteProduct}
                    onToggleManualOrdered={toggleManualOrdered}
                    onProdDragStart={handleProdDragStart}
                    onProdDragOver={handleProdDragOver}
                    onProdDrop={handleProdDrop}
                    onProdDragEnd={handleProdDragEnd}
                  />
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

      {/* Modals */}
      <AuthModal
        authModal={auth.authModal}
        setAuthModal={auth.setAuthModal}
        authTab={auth.authTab}
        setAuthTab={auth.setAuthTab}
        authForm={auth.authForm}
        setAuthForm={auth.setAuthForm}
        authError={auth.authError}
        setAuthError={auth.setAuthError}
        authLoading={auth.authLoading}
        locale={locale}
        handleAuthSubmit={auth.handleAuthSubmit}
      />

      <MyOrdersModal
        myOrdersOpen={myOrdersOpen}
        setMyOrdersOpen={setMyOrdersOpen}
        myOrders={myOrders}
        locale={locale}
      />

      <CartModal
        cartOpen={cartOpen}
        setCartOpen={setCartOpen}
        cartItems={cartItems}
        totalPrice={totalPrice}
        authUser={authUser}
        orderNote={orderNote}
        setOrderNote={setOrderNote}
        orderSuccess={orderSuccess}
        orderResult={orderResult}
        locale={locale}
        language={language}
        updateQuantity={updateQuantity}
        removeFromCart={removeFromCart}
        placeOrder={placeOrder}
      />

      <ProductDetailModal
        selectedProduct={selectedProduct}
        setSelectedProduct={setSelectedProduct}
        language={language}
        locale={locale}
        isAdmin={isAdmin}
        isInStock={isInStock}
        getCategoryChain={getCategoryChain}
        addToCart={addToCart}
      />

      <EditProductModal
        editModalOpen={editModalOpen}
        setEditModalOpen={setEditModalOpen}
        editingProductId={editingProductId}
        setEditingProductId={setEditingProductId}
        editProduct={editProduct}
        setEditProduct={setEditProduct}
        categoriesFlat={categoriesFlat}
        handleEditProductChange={handleEditProductChange}
        saveEditProduct={saveEditProduct}
        deleteEditImage={deleteEditImage}
        setPrimaryEditImage={setPrimaryEditImage}
        handleImgDragStart={handleImgDragStart}
        handleImgDrop={handleImgDrop}
      />

      <StockModal
        stockModal={stockModal}
        setStockModal={setStockModal}
        stockForm={stockForm}
        setStockForm={setStockForm}
        language={language}
        submitStockMovement={submitStockMovement}
      />

      <CategoryDrawer
        categoriesOpen={categoriesOpen}
        setCategoriesOpen={setCategoriesOpen}
        categoryTree={categoryTree}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        language={language}
        locale={locale}
        expandedRoot={expandedRoot}
        setExpandedRoot={setExpandedRoot}
      />

      <BottomNav
        isAdmin={isAdmin}
        adminOpen={adminOpen}
        cartOpen={cartOpen}
        categoriesOpen={categoriesOpen}
        authModal={auth.authModal}
        authUser={authUser}
        totalCartQty={totalCartQty}
        onSelectAll={() => { setSelectedCategory('all'); setCategoriesOpen(false) }}
        onToggleCategories={() => { setCategoriesOpen(v => !v); setCartOpen(false) }}
        onToggleAdmin={() => { setAdminOpen(v => !v); setCategoriesOpen(false) }}
        onOpenCart={() => { setCartOpen(true); setCategoriesOpen(false) }}
        onAuthAction={() => {
          setCategoriesOpen(false)
          if (authUser) {
            if (isAdmin) handleLogout()
            else { setMyOrdersOpen(true); loadMyOrders() }
          } else openAuthModal('login')
        }}
      />

      <StockHistoryModal
        stockHistory={stockHistory}
        setStockHistory={setStockHistory}
        stockHistoryData={stockHistoryData}
        language={language}
      />

    </div>
  )
}

export default App
