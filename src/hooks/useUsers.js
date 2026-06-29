import { useState } from 'react'
import { API_BASE } from '../lib/utils'

export function useUsers({ setError, authToken, isAdmin }) {
  const [usersList, setUsersList] = useState([])
  const [userEdits, setUserEdits] = useState({})
  const [userSearch, setUserSearch] = useState('')

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
      await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      setUsersList(prev => prev.filter(u => u.id !== userId))
    } catch { setError('Не може да се избрише корисникот.') }
  }

  return {
    usersList,
    userEdits, setUserEdits,
    userSearch, setUserSearch,
    loadUsers,
    getUserField,
    setUserEdit,
    saveUser,
    deleteUser,
  }
}
