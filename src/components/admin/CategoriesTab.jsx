import { availableLanguages } from '../../lib/utils'

export function CategoriesTab({
  newCategory, setNewCategory,
  validParentOptions,
  addCategory,
  authToken,
}) {
  return (
    <div className="admin-section">
      <h3>Додај категорија</h3>
      <form onSubmit={ev => addCategory(ev, authToken)} className="category-add-form">
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
  )
}
