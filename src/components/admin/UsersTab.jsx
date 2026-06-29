import { Package } from 'lucide-react'

export function UsersTab({
  usersList,
  userEdits, setUserEdits,
  userSearch, setUserSearch,
  getUserField, setUserEdit,
  saveUser, deleteUser,
  loadUsers,
}) {
  const filtered = usersList.filter(u => {
    const q = userSearch.toLowerCase()
    return !q || (u.name||'').toLowerCase().includes(q) || (u.company_name||'').toLowerCase().includes(q) || (u.email||'').toLowerCase().includes(q)
  })

  return (
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
        <span className="orders-filter-count">{filtered.length} / {usersList.length}</span>
      </div>

      {usersList.length === 0 ? (
        <div className="empty-state" style={{ border: 'none', padding: '32px 0' }}>
          <Package size={36} strokeWidth={1.2} style={{ color: 'var(--steel-300)' }} />
          <p>Нема корисници.</p>
        </div>
      ) : (
        <div className="users-list">
          {filtered.map(user => {
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
          })}
        </div>
      )}
    </div>
  )
}
