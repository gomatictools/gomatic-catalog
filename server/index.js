import express from 'express'
import cors from 'cors'
import sqlite3 from 'sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadDir = path.join(__dirname, 'uploads')
const dbFile = path.join(__dirname, 'catalog.db')
fs.mkdirSync(uploadDir, { recursive: true })

const sqlite = sqlite3.verbose()
const db = new sqlite.Database(dbFile)

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
    name_mk TEXT DEFAULT '',
    name_sr TEXT DEFAULT '',
    name_sq TEXT DEFAULT '',
    name_en TEXT DEFAULT ''
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
    await runAsync('INSERT OR IGNORE INTO categories (key, name_mk, name_sr, name_sq, name_en) VALUES (?, ?, ?, ?, ?)',
      [c.key, c.mk, c.sr, c.sq, c.en])
  }
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/uploads', express.static(uploadDir))

const supportedLangs = ['mk', 'sr', 'sq', 'en']

const buildProduct = async (productRow) => {
  const translations = await allAsync('SELECT lang, name, description FROM product_translations WHERE product_id = ?', [productRow.id])
  const image = await getAsync('SELECT url FROM images WHERE product_id = ? AND is_primary = 1 LIMIT 1', [productRow.id])
  const inventory = await getAsync('SELECT quantity FROM inventory WHERE product_id = ?', [productRow.id])

  const result = {
    id: productRow.id,
    sku: productRow.sku,
    category: productRow.category,
    price: productRow.price,
    image_url: image?.url || null,
    name: {},
    description: {},
    stock: inventory?.quantity ?? 0,
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.get('/api/categories', async (_req, res) => {
  try {
    const rows = await allAsync('SELECT key, name_mk, name_sr, name_sq, name_en FROM categories ORDER BY id ASC')
    res.json(rows.map(r => ({ key: r.key, name: { mk: r.name_mk, sr: r.name_sr, sq: r.name_sq, en: r.name_en } })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/categories', async (req, res) => {
  try {
    const { key, name } = req.body
    if (!key || !name?.mk) return res.status(400).json({ error: 'Missing required fields (key, name.mk)' })
    await runAsync('INSERT INTO categories (key, name_mk, name_sr, name_sq, name_en) VALUES (?, ?, ?, ?, ?)',
      [key, name.mk || '', name.sr || '', name.sq || '', name.en || ''])
    res.status(201).json({ key, name })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.put('/api/categories/:key', async (req, res) => {
  try {
    const { key } = req.params
    const { name } = req.body
    if (!name?.mk) return res.status(400).json({ error: 'name.mk е задолжително' })
    await runAsync(
      'UPDATE categories SET name_mk=?, name_sr=?, name_sq=?, name_en=? WHERE key=?',
      [name.mk || '', name.sr || '', name.sq || '', name.en || '', key],
    )
    res.json({ key, name })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.delete('/api/categories/:key', async (req, res) => {
  try {
    const { key } = req.params
    const inUse = await getAsync('SELECT COUNT(*) as count FROM products WHERE category = ?', [key])
    if (inUse.count > 0) {
      return res.status(409).json({ error: `Не може да се избрише категоријата — ${inUse.count} производ(и) ја користат.` })
    }
    await runAsync('DELETE FROM categories WHERE key = ?', [key])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/products', async (_req, res) => {
  try {
    const rows = await allAsync('SELECT * FROM products ORDER BY id DESC')
    const products = await Promise.all(rows.map(buildProduct))
    res.json(products)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/products/:id', async (req, res) => {
  try {
    const row = await getAsync('SELECT * FROM products WHERE id = ?', [req.params.id])
    if (!row) {
      return res.status(404).json({ error: 'Product not found' })
    }
    res.json(await buildProduct(row))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/products', async (req, res) => {
  try {
    const { sku, category, price, name, description, imageData } = req.body
    if (!sku || !category || !name || !description) {
      return res.status(400).json({ error: 'Missing required product fields' })
    }

    const insert = await runAsync('INSERT INTO products (sku, category, price) VALUES (?, ?, ?)', [sku, category, Number(price) || 0])
    const productId = insert.lastID
    const insertTranslation = 'INSERT INTO product_translations (product_id, lang, name, description) VALUES (?, ?, ?, ?)'

    await Promise.all(
      supportedLangs.map((lang) =>
        runAsync(insertTranslation, [productId, lang, name[lang] || '', description[lang] || '']),
      ),
    )

    await runAsync('INSERT OR REPLACE INTO inventory (product_id, quantity) VALUES (?, 0)', [productId])

    if (imageData) {
      saveImageFromData(productId, imageData)
    }

    const created = await getAsync('SELECT * FROM products WHERE id = ?', [productId])
    res.status(201).json(await buildProduct(created))
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { category, price, name, description, imageData } = req.body
    const existing = await getAsync('SELECT * FROM products WHERE id = ?', [id])
    if (!existing) return res.status(404).json({ error: 'Product not found' })

    await runAsync(
      'UPDATE products SET category=?, price=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [category ?? existing.category, Number(price) ?? existing.price, id],
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

app.delete('/api/products/:id', async (req, res) => {
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

app.get('/api/inventory', async (req, res) => {
  try {
    const { sku, product_id } = req.query
    let product = null
    if (sku) {
      product = await getAsync('SELECT * FROM products WHERE sku = ?', [sku])
    } else if (product_id) {
      product = await getAsync('SELECT * FROM products WHERE id = ?', [product_id])
    }
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
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
    if (!product) {
      return res.status(404).json({ error: 'Product not found' })
    }
    await runAsync('INSERT OR REPLACE INTO inventory (product_id, quantity, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [product.id, Number(quantity) || 0])
    res.json({ product_id: product.id, sku: product.sku, quantity: Number(quantity) || 0 })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`SQLite Express backend listening on http://localhost:${port}`)
})
