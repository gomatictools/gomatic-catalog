import { availableLanguages } from '../../lib/utils'

function renderCategoryAdminTree(
  nodes, depth,
  editingCategoryKey, editCategory, setEditCategory,
  editParentOptions,
  saveCategory, setEditingCategoryKey,
  deleteCategory, startEditCategory,
  dropTarget,
  handleCatDragStart, handleCatDragOver, handleCatDrop, handleCatDragEnd,
  authToken,
) {
  return nodes.map(node => (
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
            <button type="button" className="btn-save" onClick={() => saveCategory(authToken)}>Зачувај</button>
            <button type="button" className="btn-cancel" onClick={() => setEditingCategoryKey(null)}>Откажи</button>
          </div>
        </div>
      ) : (
        <div
          className={`category-item${dropTarget.key === node.key ? ` drop-${dropTarget.position}` : ''}`}
          draggable
          onDragStart={e => handleCatDragStart(e, node.key)}
          onDragOver={e => handleCatDragOver(e, node.key)}
          onDrop={e => handleCatDrop(e, node.key, authToken)}
          onDragEnd={handleCatDragEnd}
        >
          <span className="drag-handle" title="Превлечи за да прередиш">⠿</span>
          <span className="category-item-name">{node.name.mk}</span>
          <span className="category-item-langs">{node.name.sr} / {node.name.sq} / {node.name.en}</span>
          <button type="button" className="btn-edit-sm" onClick={() => startEditCategory(node)}>Уреди</button>
          <button type="button" className="category-delete" onClick={() => deleteCategory(node.key, authToken)} title="Избриши">✕</button>
        </div>
      )}
      {node.children?.length > 0 && (
        <div className="category-admin-children">
          {renderCategoryAdminTree(
            node.children, depth + 1,
            editingCategoryKey, editCategory, setEditCategory,
            editParentOptions,
            saveCategory, setEditingCategoryKey,
            deleteCategory, startEditCategory,
            dropTarget,
            handleCatDragStart, handleCatDragOver, handleCatDrop, handleCatDragEnd,
            authToken,
          )}
        </div>
      )}
    </div>
  ))
}

export function CatalogTab({
  editingProductId, editProduct, setEditProduct,
  editingCategoryKey, setEditingCategoryKey,
  editCategory, setEditCategory,
  editParentOptions,
  categoryTree,
  dropTarget,
  categoriesFlat,
  handleEditProductChange,
  saveEditProduct, setEditingProductId,
  saveCategory,
  startEditCategory,
  deleteCategory,
  handleCatDragStart, handleCatDragOver, handleCatDrop, handleCatDragEnd,
  authToken,
}) {
  return (
    <div className="admin-section">
      {editingProductId !== null && editProduct ? (
        <>
          <h3>Уреди производ — {editProduct.sku}</h3>
          <form onSubmit={saveEditProduct} className="admin-form">
            <div className="admin-grid">
              {/* ... inline edit in catalog tab (legacy) */}
              {/* This view appears when editing from catalog tab */}
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
            {renderCategoryAdminTree(
              categoryTree, 0,
              editingCategoryKey, editCategory, setEditCategory,
              editParentOptions,
              saveCategory, setEditingCategoryKey,
              deleteCategory, startEditCategory,
              dropTarget,
              handleCatDragStart, handleCatDragOver, handleCatDrop, handleCatDragEnd,
              authToken,
            )}
            {categoryTree.length === 0 && <p className="empty-hint">Нема додадени категории.</p>}
          </div>
        </>
      )}
    </div>
  )
}
