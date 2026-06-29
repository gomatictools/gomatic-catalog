import { useState } from 'react'
import { AddProductTab } from './AddProductTab'
import { CategoriesTab } from './CategoriesTab'
import { CatalogTab } from './CatalogTab'
import { DbTab } from './DbTab'
import { OrdersTab } from './OrdersTab'
import { UsersTab } from './UsersTab'

export function AdminPanel({
  authUser,
  authToken,
  // Products
  newProduct, setNewProduct,
  categoriesFlat,
  handleNewProductChange,
  addProduct,
  // Catalog / edit product in catalog tab
  editingProductId, setEditingProductId,
  editProduct, setEditProduct,
  saveEditProduct,
  // Categories
  newCategory, setNewCategory,
  validParentOptions,
  addCategory,
  // Catalog tree
  editingCategoryKey, setEditingCategoryKey,
  editCategory, setEditCategory,
  editParentOptions,
  categoryTree,
  dropTarget,
  saveCategory,
  startEditCategory,
  deleteCategory,
  handleCatDragStart, handleCatDragOver, handleCatDrop, handleCatDragEnd,
  handleEditProductChange,
  // Orders
  allOrders,
  filteredOrders,
  orderEdits, setOrderEdits,
  orderFilterUser, setOrderFilterUser,
  orderFilterStatus, setOrderFilterStatus,
  orderFilterPayment, setOrderFilterPayment,
  orderFilterDateFrom, setOrderFilterDateFrom,
  orderFilterDateTo, setOrderFilterDateTo,
  getOrderField, setOrderEdit,
  saveOrder, deleteOrder,
  loadAllOrders,
  // Users
  usersList,
  userEdits, setUserEdits,
  userSearch, setUserSearch,
  getUserField, setUserEdit,
  saveUser, deleteUser,
  loadUsers,
  // DB
  exportProducts,
  importProductsFromFile,
}) {
  const [adminTab, setAdminTab] = useState('products')
  const [adminContentOpen, setAdminContentOpen] = useState(false)

  if (!authUser || authUser.role !== 'admin') return null

  const tabs = [
    { key: 'products',   label: 'Додавање производи' },
    { key: 'categories', label: 'Додавање категории' },
    { key: 'catalog',    label: 'Уредување на каталог' },
    { key: 'db',         label: 'Управување со база' },
    { key: 'orders',     label: 'Нарачки' },
    { key: 'users',      label: 'Корисници' },
  ]

  return (
    <section className="admin-panel">
      <div className="admin-panel__tabs-bar">
        <div className="admin-panel__inner">
          <div className="admin-tabs">
            {tabs.map(tab => (
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
          {adminTab === 'products' && (
            <AddProductTab
              newProduct={newProduct}
              setNewProduct={setNewProduct}
              categoriesFlat={categoriesFlat}
              handleNewProductChange={handleNewProductChange}
              addProduct={addProduct}
            />
          )}

          {adminTab === 'categories' && (
            <CategoriesTab
              newCategory={newCategory}
              setNewCategory={setNewCategory}
              validParentOptions={validParentOptions}
              addCategory={addCategory}
              authToken={authToken}
            />
          )}

          {adminTab === 'catalog' && (
            <CatalogTab
              editingProductId={editingProductId}
              editProduct={editProduct}
              setEditProduct={setEditProduct}
              editingCategoryKey={editingCategoryKey}
              setEditingCategoryKey={setEditingCategoryKey}
              editCategory={editCategory}
              setEditCategory={setEditCategory}
              editParentOptions={editParentOptions}
              categoryTree={categoryTree}
              dropTarget={dropTarget}
              categoriesFlat={categoriesFlat}
              handleEditProductChange={handleEditProductChange}
              saveEditProduct={saveEditProduct}
              setEditingProductId={setEditingProductId}
              saveCategory={saveCategory}
              startEditCategory={startEditCategory}
              deleteCategory={deleteCategory}
              handleCatDragStart={handleCatDragStart}
              handleCatDragOver={handleCatDragOver}
              handleCatDrop={handleCatDrop}
              handleCatDragEnd={handleCatDragEnd}
              authToken={authToken}
            />
          )}

          {adminTab === 'db' && (
            <DbTab
              exportProducts={exportProducts}
              importProductsFromFile={importProductsFromFile}
            />
          )}

          {adminTab === 'orders' && (
            <OrdersTab
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
            />
          )}

          {adminTab === 'users' && (
            <UsersTab
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
            />
          )}
        </div>
      )}
    </section>
  )
}
