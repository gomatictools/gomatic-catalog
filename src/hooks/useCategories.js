import { useCallback, useMemo, useRef, useState } from 'react'
import { API_BASE, slugify, emptyNewCategory } from '../lib/utils'

export function useCategories({ setError, language }) {
  const [categoryList, setCategoryList] = useState([])
  const [newCategory, setNewCategory] = useState(emptyNewCategory())
  const [editingCategoryKey, setEditingCategoryKey] = useState(null)
  const [editCategory, setEditCategory] = useState({ name: { mk: '', sr: '', sq: '', en: '' }, parent_key: null })
  const dragStateRef = useRef({ key: null, position: null })
  const [dropTarget, setDropTarget] = useState({ key: null, position: null })

  const loadCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/categories`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCategoryList(data)
      return data
    } catch { /* silent */ }
    return []
  }

  // ── Computed ──────────────────────────────────────────────────────────────────
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

  // ── CRUD ──────────────────────────────────────────────────────────────────────
  const addCategory = async (ev, authToken) => {
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

  const saveCategory = async (authToken) => {
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

  const deleteCategory = async (key, authToken) => {
    try {
      const res = await fetch(`${API_BASE}/api/categories/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      if (!res.ok) { const b = await res.json(); throw new Error(b.error || 'Грешка') }
      await loadCategories()
    } catch (err) {
      setError(err.message || 'Не може да се избрише категоријата.')
    }
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────────
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

  const handleCatDrop = async (e, targetKey, authToken) => {
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

  return {
    categoryList, setCategoryList,
    newCategory, setNewCategory,
    editingCategoryKey, setEditingCategoryKey,
    editCategory, setEditCategory,
    dragStateRef,
    dropTarget,
    catDepthMap,
    categoryTree,
    categoriesFlat,
    getCategoryName,
    getCategoryChain,
    getDescendantKeys,
    validParentOptions,
    editParentOptions,
    loadCategories,
    addCategory,
    startEditCategory,
    saveCategory,
    deleteCategory,
    handleCatDragStart,
    handleCatDragOver,
    handleCatDrop,
    handleCatDragEnd,
  }
}
