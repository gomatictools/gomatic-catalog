import express from 'express'
import cors from 'cors'
import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'gomatic-secret-2024'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadDir = path.join(__dirname, 'uploads')
const dbFile = path.join(__dirname, 'catalog.db')
fs.mkdirSync(uploadDir, { recursive: true })

const sqlite = sqlite3.verbose()
const db = new sqlite.Database(dbFile)
db.run('PRAGMA foreign_keys = ON')

const runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err)
      else resolve(this)
    })
  })

const getAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })

const allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })

await runAsync(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sku TEXT UNIQUE,
    category TEXT,
    price REAL DEFAULT 0,
    image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`)
await runAsync(`
  CREATE TABLE IF NOT EXISTS product_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    lang TEXT,
    name TEXT,
    description TEXT,
    UNIQUE(product_id, lang),
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );
`)
await runAsync(`
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER UNIQUE,
    quantity INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );
`)
await runAsync(`
  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    url TEXT,
    is_primary INTEGER DEFAULT 0,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );
`)
await runAsync(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE,
    parent_key TEXT DEFAULT NULL,
    name_mk TEXT DEFAULT '',
    name_sr TEXT DEFAULT '',
    name_sq TEXT DEFAULT '',
    name_en TEXT DEFAULT ''
  );
`)

// Migration: add parent_key column if it doesn't exist yet
try {
  await runAsync('ALTER TABLE categories ADD COLUMN parent_key TEXT DEFAULT NULL')
} catch {
  // column already exists — safe to ignore
}

// Migration: add sort_order column for drag-and-drop reordering
try {
  await runAsync('ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0')
} catch { /* column already exists */ }

// Migration: add sort_order to products
try {
  await runAsync('ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0')
} catch { /* column already exists */ }

// Migration: add critical_stock to products
try {
  await runAsync('ALTER TABLE products ADD COLUMN critical_stock INTEGER DEFAULT 0')
} catch { /* column already exists */ }

try { await runAsync('ALTER TABLE images ADD COLUMN sort_order INTEGER DEFAULT 0') } catch { /* exists */ }

await runAsync(`
  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    type TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    party TEXT DEFAULT '',
    note TEXT DEFAULT '',
    movement_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
  );
`)

await runAsync(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    name TEXT,
    password_hash TEXT,
    role TEXT DEFAULT 'user',
    company_name TEXT DEFAULT '',
    is_private INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`)

// Migrations for existing DBs
try { await runAsync("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'") } catch { /* exists */ }
try { await runAsync("ALTER TABLE users ADD COLUMN company_name TEXT DEFAULT ''") } catch { /* exists */ }
try { await runAsync("ALTER TABLE users ADD COLUMN is_private INTEGER DEFAULT 0") } catch { /* exists */ }
try { await runAsync("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''") } catch { /* exists */ }
try { await runAsync("ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'unpaid'") } catch { /* exists */ }

// Make zoranveli@gmail.com admin; fallback: first user if no admin exists
await runAsync("UPDATE users SET role='admin' WHERE email='zoranveli@gmail.com'")
await runAsync(`
  UPDATE users SET role='admin'
  WHERE id=(SELECT MIN(id) FROM users)
  AND NOT EXISTS (SELECT 1 FROM users WHERE role='admin')
`)

await runAsync(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    status TEXT DEFAULT 'pending',
    total REAL DEFAULT 0,
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`)

await runAsync(`
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    product_id INTEGER,
    sku TEXT,
    name TEXT,
    price REAL,
    quantity INTEGER,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`)

const catCount = await getAsync('SELECT COUNT(*) as count FROM categories')
if (catCount.count === 0) {
  const defaults = [
    { key: 'tools', mk: 'Алатки', sr: 'Alatke', sq: 'Vegla', en: 'Tools' },
    { key: 'measurements', mk: 'Мерења', sr: 'Merenja', sq: 'Matje', en: 'Measurements' },
    { key: 'accessories', mk: 'Аксесоари', sr: 'Aksesoari', sq: 'Aksesorë', en: 'Accessories' },
  ]
  for (const c of defaults) {
    await runAsync('INSERT OR IGNORE INTO categories (key, parent_key, name_mk, name_sr, name_sq, name_en) VALUES (?, NULL, ?, ?, ?, ?)',
      [c.key, c.mk, c.sr, c.sq, c.en])
  }
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/uploads', express.static(uploadDir))

const supportedLangs = ['mk', 'sr', 'sq', 'en']

// Returns the depth of a category (0 = root, 1 = subcategory, 2 = sub-subcategory)
const getCategoryDepth = async (key, seen = new Set()) => {
  if (!key || seen.has(key)) return 0
  seen.add(key)
  const row = await getAsync('SELECT parent_key FROM categories WHERE key = ?', [key])
  if (!row || !row.parent_key) return 0
  return 1 + await getCategoryDepth(row.parent_key, seen)
}

// Returns the max height of the subtree rooted at key (0 = leaf)
const getSubtreeHeight = async (key) => {
  const children = await allAsync('SELECT key FROM categories WHERE parent_key = ?', [key])
  if (children.length === 0) return 0
  const heights = await Promise.all(children.map(c => getSubtreeHeight(c.key)))
  return 1 + Math.max(...heights)
}

// Returns all descendant keys of a category
const getAllDescendantKeys = async (key) => {
  const keys = new Set()
  const add = async (k) => {
    const children = await allAsync('SELECT key FROM categories WHERE parent_key = ?', [k])
    for (const c of children) {
      keys.add(c.key)
      await add(c.key)
    }
  }
  await add(key)
  return keys
}

const buildProduct = async (productRow) => {
  const translations = await allAsync('SELECT lang, name, description FROM product_translations WHERE product_id = ?', [productRow.id])
  const allImages = await allAsync('SELECT id, url, is_primary FROM images WHERE product_id = ? ORDER BY sort_order ASC, is_primary DESC, id ASC LIMIT 3', [productRow.id])
  const inventory = await getAsync('SELECT quantity FROM inventory WHERE product_id = ?', [productRow.id])

  const result = {
    id: productRow.id,
    sku: productRow.sku,
    category: productRow.category,
    price: productRow.price,
    image_url: allImages[0]?.url || null,
    images: allImages,
    name: {},
    description: {},
    stock: inventory?.quantity ?? 0,
    critical_stock: productRow.critical_stock ?? 0,
  }

  translations.forEach((entry) => {
    result.name[entry.lang] = entry.name
    result.description[entry.lang] = entry.description
  })

  supportedLangs.forEach((lang) => {
    if (result.name[lang] === undefined) result.name[lang] = ''
    if (result.description[lang] === undefined) result.description[lang] = ''
  })

  return result
}

const saveImageFromData = (productId, imageData) => {
  if (!imageData || !imageData.startsWith('data:')) return null
  const matches = imageData.match(/^data:(image\/[^;]+);base64,(.*)$/)
  if (!matches) return null
  const [, mimeType, data] = matches
  const ext = mimeType.split('/')[1].replace(/[^a-z0-9]/gi, '') || 'png'
  const fileName = `${productId}-${Date.now()}.${ext}`
  const filePath = path.join(uploadDir, fileName)
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'))
  const url = `/uploads/${fileName}`
  db.run('INSERT INTO images (product_id, url, is_primary) VALUES (?, ?, 1)', [productId, url])
  return url
}

// ── Auth middleware ───────────────────────────────────────────────────────────

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Не сте најавени.' })
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Невалиден или истечен токен.' })
  }
}

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Пристапот е забранет.' })
    next()
  })
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// ── Categories ────────────────────────────────────────────────────────────────

app.get('/api/categories', async (_req, res) => {
  try {
    const rows = await allAsync('SELECT key, parent_key, name_mk, name_sr, name_sq, name_en FROM categories ORDER BY sort_order ASC, id ASC')
    res.json(rows.map(r => ({
      key: r.key,
      parent_key: r.parent_key || null,
      name: { mk: r.name_mk, sr: r.name_sr, sq: r.name_sq, en: r.name_en },
    })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/categories', requireAdmin, async (req, res) => {
  try {
    const { key, name, parent_key } = req.body
    if (!key || !name?.mk) return res.status(400).json({ error: 'key и name.mk се задолжителни' })

    if (parent_key) {
      const parentDepth = await getCategoryDepth(parent_key)
      if (parentDepth >= 2) {
        return res.status(400).json({ error: 'Максимална длабочина е 2 нивоа под главната категорија.' })
      }
    }

    await runAsync(
      'INSERT INTO categories (key, parent_key, name_mk, name_sr, name_sq, name_en) VALUES (?, ?, ?, ?, ?, ?)',
      [key, parent_key || null, name.mk || '', name.sr || '', name.sq || '', name.en || ''],
    )
    res.status(201).json({ key, parent_key: parent_key || null, name })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.put('/api/categories/reorder', requireAdmin, async (req, res) => {
  try {
    const updates = req.body
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected array' })
    for (const { key, sort_order } of updates) {
      await runAsync('UPDATE categories SET sort_order = ? WHERE key = ?', [sort_order, key])
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/categories/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params
    const { name, parent_key } = req.body
    if (!name?.mk) return res.status(400).json({ error: 'name.mk е задолжително' })

    const newParent = parent_key || null

    if (newParent) {
      // Prevent cycles
      const descendants = await getAllDescendantKeys(key)
      if (descendants.has(newParent) || newParent === key) {
        return res.status(400).json({ error: 'Не може да се постави потомок или самиот себе за родителска категорија.' })
      }
      // Check depth constraint: newParentDepth + 1 + subtreeHeight <= 2
      const newParentDepth = await getCategoryDepth(newParent)
      const subtreeHeight = await getSubtreeHeight(key)
      if (newParentDepth + 1 + subtreeHeight > 2) {
        return res.status(400).json({ error: 'Ова би го надминало максималното ниво на вгнезденост (2 нивоа).' })
      }
    }

    await runAsync(
      'UPDATE categories SET parent_key=?, name_mk=?, name_sr=?, name_sq=?, name_en=? WHERE key=?',
      [newParent, name.mk || '', name.sr || '', name.sq || '', name.en || '', key],
    )
    res.json({ key, parent_key: newParent, name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/categories/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params
    const inUse = await getAsync('SELECT COUNT(*) as count FROM products WHERE category = ?', [key])
    if (inUse.count > 0) {
      return res.status(409).json({ error: `Не може да се избрише — ${inUse.count} производ(и) ја користат.` })
    }
    const hasChildren = await getAsync('SELECT COUNT(*) as count FROM categories WHERE parent_key = ?', [key])
    if (hasChildren.count > 0) {
      return res.status(409).json({ error: 'Не може да се избрише — категоријата има подкатегории.' })
    }
    await runAsync('DELETE FROM categories WHERE key = ?', [key])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Products ──────────────────────────────────────────────────────────────────

app.put('/api/products/reorder', requireAdmin, async (req, res) => {
  try {
    const updates = req.body
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected array' })
    for (const { id, sort_order } of updates) {
      await runAsync('UPDATE products SET sort_order = ? WHERE id = ?', [sort_order, id])
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/products', async (_req, res) => {
  try {
    const rows = await allAsync('SELECT * FROM products ORDER BY sort_order ASC, id ASC')
    const products = await Promise.all(rows.map(buildProduct))
    res.json(products)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/products/:id', async (req, res) => {
  try {
    const row = await getAsync('SELECT * FROM products WHERE id = ?', [req.params.id])
    if (!row) return res.status(404).json({ error: 'Product not found' })
    res.json(await buildProduct(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/products', requireAdmin, async (req, res) => {
  try {
    const { sku, category, price, name, description, imageData, critical_stock } = req.body
    if (!sku || !category || !name || !description) {
      return res.status(400).json({ error: 'Missing required product fields' })
    }

    const insert = await runAsync('INSERT INTO products (sku, category, price, critical_stock) VALUES (?, ?, ?, ?)', [sku, category, Number(price) || 0, Number(critical_stock) || 0])
    const productId = insert.lastID
    const insertTranslation = 'INSERT INTO product_translations (product_id, lang, name, description) VALUES (?, ?, ?, ?)'

    await Promise.all(
      supportedLangs.map((lang) =>
        runAsync(insertTranslation, [productId, lang, name[lang] || '', description[lang] || '']),
      ),
    )

    await runAsync('INSERT OR REPLACE INTO inventory (product_id, quantity) VALUES (?, 0)', [productId])

    if (imageData) saveImageFromData(productId, imageData)

    const created = await getAsync('SELECT * FROM products WHERE id = ?', [productId])
    res.status(201).json(await buildProduct(created))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { category, price, sku, name, description, imageData, critical_stock } = req.body
    const existing = await getAsync('SELECT * FROM products WHERE id = ?', [id])
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    const newSku = sku?.trim() || existing.sku
    if (newSku !== existing.sku) {
      const conflict = await getAsync('SELECT id FROM products WHERE sku = ? AND id != ?', [newSku, id])
      if (conflict) return res.status(409).json({ error: `SKU "${newSku}" веќе постои.` })
    }

    const newCriticalStock = critical_stock !== undefined ? Number(critical_stock) : (existing.critical_stock ?? 0)

    await runAsync(
      'UPDATE products SET sku=?, category=?, price=?, critical_stock=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [newSku, category ?? existing.category, Number(price) ?? existing.price, newCriticalStock, id],
    )

    if (name || description) {
      for (const lang of supportedLangs) {
        await runAsync(
          'INSERT OR REPLACE INTO product_translations (product_id, lang, name, description) VALUES (?, ?, ?, ?)',
          [id, lang, name?.[lang] ?? '', description?.[lang] ?? ''],
        )
      }
    }

    if (imageData) {
      await runAsync('UPDATE images SET is_primary=0 WHERE product_id=?', [id])
      saveImageFromData(id, imageData)
    }

    const updated = await getAsync('SELECT * FROM products WHERE id = ?', [id])
    res.json(await buildProduct(updated))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const existing = await getAsync('SELECT * FROM products WHERE id = ?', [id])
    if (!existing) return res.status(404).json({ error: 'Product not found' })
    await runAsync('DELETE FROM products WHERE id = ?', [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Inventory ─────────────────────────────────────────────────────────────────

app.get('/api/inventory', async (req, res) => {
  try {
    const { sku, product_id } = req.query
    let product = null
    if (sku) {
      product = await getAsync('SELECT * FROM products WHERE sku = ?', [sku])
    } else if (product_id) {
      product = await getAsync('SELECT * FROM products WHERE id = ?', [product_id])
    }
    if (!product) return res.status(404).json({ error: 'Product not found' })
    const inventory = await getAsync('SELECT quantity FROM inventory WHERE product_id = ?', [product.id])
    res.json({ product_id: product.id, sku: product.sku, quantity: inventory?.quantity ?? 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/inventory', async (req, res) => {
  try {
    const { product_id, sku, quantity } = req.body
    let product = null
    if (product_id) {
      product = await getAsync('SELECT * FROM products WHERE id = ?', [product_id])
    } else if (sku) {
      product = await getAsync('SELECT * FROM products WHERE sku = ?', [sku])
    }
    if (!product) return res.status(404).json({ error: 'Product not found' })
    await runAsync('INSERT OR REPLACE INTO inventory (product_id, quantity, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [product.id, Number(quantity) || 0])
    res.json({ product_id: product.id, sku: product.sku, quantity: Number(quantity) || 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Image management ──────────────────────────────────────────────────────────

app.delete('/api/products/:id/images/:imageId', requireAdmin, async (req, res) => {
  try {
    const { id, imageId } = req.params
    const img = await getAsync('SELECT id, is_primary FROM images WHERE id = ? AND product_id = ?', [imageId, id])
    if (!img) return res.status(404).json({ error: 'Сликата не е пронајдена.' })
    await runAsync('DELETE FROM images WHERE id = ?', [imageId])
    if (img.is_primary) {
      await runAsync('UPDATE images SET is_primary = 1 WHERE product_id = ? ORDER BY id DESC LIMIT 1', [id])
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/products/:id/images', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { imageData } = req.body
    if (!imageData) return res.status(400).json({ error: 'imageData е задолжително' })
    const count = await getAsync('SELECT COUNT(*) as cnt FROM images WHERE product_id = ?', [id])
    if (count.cnt >= 3) return res.status(409).json({ error: 'Максимум 3 слики по производ.' })
    const url = saveImageFromData(id, imageData)
    if (!url) return res.status(400).json({ error: 'Неважечки imageData.' })
    // Make sure only the first image is primary
    const primaryExists = await getAsync('SELECT id FROM images WHERE product_id = ? AND is_primary = 1', [id])
    if (!primaryExists) {
      await runAsync('UPDATE images SET is_primary = 1 WHERE product_id = ? ORDER BY id ASC LIMIT 1', [id])
    } else {
      await runAsync('UPDATE images SET is_primary = 0 WHERE product_id = ? AND url = ?', [id, url])
    }
    const newImg = await getAsync('SELECT id, url FROM images WHERE product_id = ? AND url = ?', [id, url])
    res.status(201).json(newImg)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/products/:id/images/reorder', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const { order } = req.body // array of image IDs in new order
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of image IDs' })
    for (let i = 0; i < order.length; i++) {
      await runAsync('UPDATE images SET sort_order = ? WHERE id = ? AND product_id = ?', [i, order[i], id])
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/products/:id/images/:imageId/primary', requireAdmin, async (req, res) => {
  try {
    const { id, imageId } = req.params
    const img = await getAsync('SELECT id FROM images WHERE id = ? AND product_id = ?', [imageId, id])
    if (!img) return res.status(404).json({ error: 'Сликата не е пронајдена.' })
    await runAsync('UPDATE images SET is_primary = 0 WHERE product_id = ?', [id])
    await runAsync('UPDATE images SET is_primary = 1 WHERE id = ?', [imageId])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Stock movements ───────────────────────────────────────────────────────────

app.post('/api/stock/in', requireAdmin, async (req, res) => {
  try {
    const { product_id, quantity, party, note, date } = req.body
    if (!product_id || !quantity || quantity < 1) return res.status(400).json({ error: 'Задолжителни: product_id и quantity >= 1' })
    const product = await getAsync('SELECT id FROM products WHERE id = ?', [product_id])
    if (!product) return res.status(404).json({ error: 'Производот не е пронајден' })
    const qty = Number(quantity)
    await runAsync(
      'INSERT INTO stock_movements (product_id, type, quantity, party, note, movement_date) VALUES (?, ?, ?, ?, ?, ?)',
      [product_id, 'in', qty, party || '', note || '', date || new Date().toISOString().split('T')[0]],
    )
    await runAsync(
      'INSERT OR REPLACE INTO inventory (product_id, quantity, updated_at) VALUES (?, COALESCE((SELECT quantity FROM inventory WHERE product_id = ?), 0) + ?, CURRENT_TIMESTAMP)',
      [product_id, product_id, qty],
    )
    const inv = await getAsync('SELECT quantity FROM inventory WHERE product_id = ?', [product_id])
    res.json({ success: true, new_quantity: inv?.quantity ?? 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/stock/out', requireAdmin, async (req, res) => {
  try {
    const { product_id, quantity, party, note, date } = req.body
    if (!product_id || !quantity || quantity < 1) return res.status(400).json({ error: 'Задолжителни: product_id и quantity >= 1' })
    const product = await getAsync('SELECT id FROM products WHERE id = ?', [product_id])
    if (!product) return res.status(404).json({ error: 'Производот не е пронајден' })
    const qty = Number(quantity)
    const inv = await getAsync('SELECT quantity FROM inventory WHERE product_id = ?', [product_id])
    const current = inv?.quantity ?? 0
    if (current < qty) return res.status(409).json({ error: `Нема доволно залиха. Достапно: ${current} ед.` })
    await runAsync(
      'INSERT INTO stock_movements (product_id, type, quantity, party, note, movement_date) VALUES (?, ?, ?, ?, ?, ?)',
      [product_id, 'out', qty, party || '', note || '', date || new Date().toISOString().split('T')[0]],
    )
    await runAsync(
      'UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?',
      [qty, product_id],
    )
    const updated = await getAsync('SELECT quantity FROM inventory WHERE product_id = ?', [product_id])
    res.json({ success: true, new_quantity: updated?.quantity ?? 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/stock/:product_id', requireAdmin, async (req, res) => {
  try {
    const rows = await allAsync(
      'SELECT * FROM stock_movements WHERE product_id = ? ORDER BY movement_date DESC, id DESC',
      [req.params.product_id],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Auth endpoints ────────────────────────────────────────────────────────────

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, name, password, company_name, is_private, phone } = req.body
    if (!email || !name || !password || !phone) return res.status(400).json({ error: 'Сите полиња се задолжителни.' })
    if (password.length < 6) return res.status(400).json({ error: 'Лозинката мора да има барем 6 знаци.' })
    const existing = await getAsync('SELECT id FROM users WHERE email = ?', [email.toLowerCase()])
    if (existing) return res.status(409).json({ error: 'Е-пошта е веќе регистрирана.' })
    const hash = await bcrypt.hash(password, 10)
    const isPriv = is_private ? 1 : 0
    const compName = isPriv ? '' : (company_name || '').trim()
    const result = await runAsync(
      'INSERT INTO users (email, name, password_hash, role, company_name, is_private, phone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email.toLowerCase(), name.trim(), hash, 'user', compName, isPriv, (phone || '').trim()]
    )
    const user = { id: result.lastID, email: email.toLowerCase(), name: name.trim(), role: 'user', company_name: compName, is_private: isPriv, phone: (phone || '').trim() }
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' })
    res.status(201).json({ token, user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'Внесете е-пошта и лозинка.' })
    const row = await getAsync('SELECT * FROM users WHERE email = ?', [email.toLowerCase()])
    if (!row) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })
    const ok = await bcrypt.compare(password, row.password_hash)
    if (!ok) return res.status(401).json({ error: 'Погрешна е-пошта или лозинка.' })
    const user = { id: row.id, email: row.email, name: row.name, role: row.role || 'user', company_name: row.company_name || '', is_private: row.is_private || 0 }
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

// ── Orders ────────────────────────────────────────────────────────────────────

app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const { items, note, total } = req.body
    if (!items || !items.length) return res.status(400).json({ error: 'Кошничката е празна.' })

    // Check stock availability before creating the order
    for (const item of items) {
      const inv = await getAsync('SELECT quantity FROM inventory WHERE product_id = ?', [item.product_id])
      const available = inv?.quantity ?? 0
      if (available < item.quantity) {
        return res.status(409).json({
          error: `„${item.name}" — нема доволно залиха. Достапно: ${available} ед., нарачано: ${item.quantity} ед.`,
        })
      }
    }

    const order = await runAsync(
      'INSERT INTO orders (user_id, status, total, note) VALUES (?, ?, ?, ?)',
      [req.user.id, 'pending', Number(total) || 0, note || ''],
    )
    const orderId = order.lastID

    for (const item of items) {
      await runAsync(
        'INSERT INTO order_items (order_id, product_id, sku, name, price, quantity) VALUES (?, ?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.sku, item.name, item.price, item.quantity],
      )
      // Reduce inventory — never go below 0
      await runAsync(
        'UPDATE inventory SET quantity = MAX(0, quantity - ?), updated_at = CURRENT_TIMESTAMP WHERE product_id = ?',
        [item.quantity, item.product_id],
      )
    }

    res.status(201).json({ id: orderId, status: 'pending', total, created_at: new Date().toISOString() })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/orders/my', requireAuth, async (req, res) => {
  try {
    const rows = await allAsync('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [req.user.id])
    const orders = await Promise.all(rows.map(async (o) => {
      const items = await allAsync('SELECT * FROM order_items WHERE order_id = ?', [o.id])
      return { ...o, items }
    }))
    res.json(orders)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Admin: all orders
app.get('/api/orders', requireAdmin, async (req, res) => {
  try {
    const rows = await allAsync(`
      SELECT o.*, u.name as user_name, u.company_name
      FROM orders o JOIN users u ON o.user_id = u.id
      ORDER BY o.id DESC
    `)
    const orders = await Promise.all(rows.map(async (o) => {
      const items = await allAsync('SELECT * FROM order_items WHERE order_id = ?', [o.id])
      return { ...o, items }
    }))
    res.json(orders)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { status, payment_status } = req.body
    const allowed = ['pending', 'ready', 'delivered']
    const allowedPay = ['unpaid', 'paid']
    if (status && !allowed.includes(status)) return res.status(400).json({ error: 'Невалиден статус.' })
    if (payment_status && !allowedPay.includes(payment_status)) return res.status(400).json({ error: 'Невалиден статус на наплата.' })
    await runAsync(
      'UPDATE orders SET status = COALESCE(?, status), payment_status = COALESCE(?, payment_status) WHERE id = ?',
      [status || null, payment_status || null, req.params.id]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    await runAsync('DELETE FROM orders WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const rows = await allAsync(
      'SELECT id, email, name, company_name, is_private, phone, role, created_at FROM users ORDER BY id DESC'
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const { name, email, company_name, is_private, phone, role } = req.body
    const allowedRoles = ['user', 'admin']
    if (role && !allowedRoles.includes(role)) return res.status(400).json({ error: 'Невалидна улога.' })
    if (email) {
      const conflict = await getAsync('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase(), req.params.id])
      if (conflict) return res.status(409).json({ error: 'Е-пошта е веќе зафатена.' })
    }
    await runAsync(
      `UPDATE users SET
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        company_name = COALESCE(?, company_name),
        is_private = COALESCE(?, is_private),
        phone = COALESCE(?, phone),
        role = COALESCE(?, role)
       WHERE id = ?`,
      [
        name ?? null,
        email ? email.toLowerCase() : null,
        company_name ?? null,
        is_private !== undefined ? (is_private ? 1 : 0) : null,
        phone ?? null,
        role ?? null,
        req.params.id
      ]
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const self = await getAsync('SELECT id FROM users WHERE id = ?', [req.params.id])
    if (!self) return res.status(404).json({ error: 'Корисникот не постои.' })
    await runAsync('DELETE FROM orders WHERE user_id = ?', [req.params.id])
    await runAsync('DELETE FROM users WHERE id = ?', [req.params.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`SQLite Express backend listening on http://localhost:${port}`)
})
