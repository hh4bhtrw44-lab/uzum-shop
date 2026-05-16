const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const initSqlJs = require('sql.js');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'uzum-platform-secret-key-2024';
const DB_PATH = path.join(__dirname, 'uzum.db');

// ========== sql.js Database Wrapper ==========
let SQL = null;
let db = null;

async function getDb() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  if (db) {
    // Save current to disk before reloading
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    db.close();
  }
  let buffer;
  if (fs.existsSync(DB_PATH)) {
    buffer = fs.readFileSync(DB_PATH);
  } else {
    buffer = new Uint8Array(0);
  }
  db = new SQL.Database(buffer);
  db.run('PRAGMA foreign_keys = ON');
  return db;
}

async function query(sql, params = []) {
  const d = await getDb();
  try {
    if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('PRAGMA') || sql.trim().toUpperCase().startsWith('WITH')) {
      const stmt = d.prepare(sql);
      if (params.length > 0) stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    } else {
      d.run(sql, params);
      const changes = d.getRowsModified();
      // Save after write
      const data = d.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
      return { changes };
    }
  } finally {
    // Don't close db here - keep for subsequent calls in same tick
  }
}

async function querySingle(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function run(sql, params = []) {
  return await query(sql, params);
}

// Initialize DB on startup
async function initServer() {
  const d = await getDb();
  
  // Create tables
  d.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, vip_level INTEGER DEFAULT 1, balance REAL DEFAULT 0, total_commission REAL DEFAULT 0, ext_code TEXT UNIQUE, created_at DATETIME DEFAULT (datetime(\'now\')))');
  d.run('CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL, image TEXT DEFAULT \'📦\', category TEXT DEFAULT \'general\', created_at DATETIME DEFAULT (datetime(\'now\')))');
  d.run('CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, product_id INTEGER NOT NULL, status TEXT DEFAULT \'pending\', commission REAL DEFAULT 0, created_at DATETIME DEFAULT (datetime(\'now\')), FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (product_id) REFERENCES products(id))');
  d.run("CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, type TEXT NOT NULL CHECK(type IN ('recharge', 'withdrawal', 'commission')), amount REAL NOT NULL, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT (datetime('now')), FOREIGN KEY (user_id) REFERENCES users(id))");
  d.run('CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL)');
  d.run("CREATE TABLE IF NOT EXISTS commissions (id INTEGER PRIMARY KEY AUTOINCREMENT, username_display TEXT NOT NULL, amount REAL NOT NULL, created_at DATETIME DEFAULT (datetime('now')))");
  d.run('CREATE TABLE IF NOT EXISTS vip_levels (id INTEGER PRIMARY KEY AUTOINCREMENT, level INTEGER UNIQUE NOT NULL, order_limit INTEGER NOT NULL DEFAULT 5, upgrade_price REAL DEFAULT 0)');
  
  // Save schema
  const schemaData = d.export();
  fs.writeFileSync(DB_PATH, Buffer.from(schemaData));
  console.log('✅ Database loaded');

  // Seed if needed
  const adminCount = await query("SELECT COUNT(*) as count FROM admins");
  if (adminCount[0].count === 0) {
    const hashedPwd = bcrypt.hashSync('admin123', 10);
    await run('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hashedPwd]);
    console.log('✅ Default admin created');
  }

  const vipCount = await query("SELECT COUNT(*) as count FROM vip_levels");
  if (vipCount[0].count === 0) {
    const levels = [[1,5,0],[2,15,199],[3,30,499],[4,60,999],[5,100,1999]];
    for (const [level, limit, price] of levels) {
      await run('INSERT INTO vip_levels (level, order_limit, upgrade_price) VALUES (?, ?, ?)', [level, limit, price]);
    }
    console.log('✅ VIP levels seeded');
  }

  const productCount = await query("SELECT COUNT(*) as count FROM products");
  if (productCount[0].count === 0) {
    const products = [
      ['iPhone 15 Pro Max', 8999, '📱', 'electronics'],
      ['AirPods Pro 2', 1899, '🎧', 'electronics'],
      ['MacBook Air M3', 10999, '💻', 'electronics'],
      ['iPad Air M2', 5999, '📱', 'electronics'],
      ['Apple Watch Ultra', 6299, '⌚', 'electronics'],
      ['Designer Handbag', 3599, '👛', 'fashion'],
      ['Luxury Sneakers', 1299, '👟', 'fashion'],
      ['Diamond Ring', 15999, '💍', 'jewelry'],
      ['Gaming Console', 3999, '🎮', 'electronics'],
      ['Smart TV 65"', 8999, '📺', 'electronics'],
      ['Sony WH-1000XM5', 2599, '🎧', 'electronics'],
      ['Dyson V15 Vacuum', 4999, '🧹', 'home'],
      ['Nespresso Machine', 2999, '☕', 'home'],
      ['Perfume Collection', 899, '🧴', 'beauty'],
      ['PS5 Slim', 4299, '🎮', 'electronics'],
      ['Canon EOS R6', 15999, '📷', 'electronics'],
      ['Lego Star Wars Set', 1299, '🧩', 'toys'],
      ['Electric Scooter', 3299, '🛴', 'sports'],
      ['Drone DJI Mini 4', 6499, '✈️', 'electronics'],
      ['Wireless Earbuds', 699, '🔊', 'electronics'],
    ];
    for (const [name, price, image, category] of products) {
      await run('INSERT INTO products (name, price, image, category) VALUES (?, ?, ?, ?)', [name, price, image, category]);
    }
    console.log('✅ Sample products seeded');
  }

  const userCount = await query("SELECT COUNT(*) as count FROM users");
  if (userCount[0].count === 0) {
    const hashedPwd = bcrypt.hashSync('test123', 10);
    const extCode = 'UZ' + Math.random().toString(36).substring(2, 8).toUpperCase();
    await run('INSERT INTO users (username, password, vip_level, balance, ext_code) VALUES (?, ?, ?, ?, ?)',
      ['testuser', hashedPwd, 2, 5000, extCode]);
    console.log('✅ Sample user created: testuser / test123');
  }

  const commCount = await query("SELECT COUNT(*) as count FROM commissions");
  if (commCount[0].count === 0) {
    const commissions = [
      ['Alex***', 156.80], ['Maria***', 89.50], ['John***', 234.00],
      ['Sophie***', 67.90], ['David***', 412.30], ['Emma***', 123.45],
      ['Chris***', 78.60], ['Lisa***', 345.00], ['Tom***', 56.70],
      ['Anna***', 198.20], ['Mike***', 890.00], ['Sarah***', 234.50],
      ['Kevin***', 567.80], ['Jessica***', 45.60], ['Ryan***', 678.90],
    ];
    for (const [name, amount] of commissions) {
      await run('INSERT INTO commissions (username_display, amount) VALUES (?, ?)', [name, amount]);
    }
    console.log('✅ Sample commissions seeded');
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// JWT Auth Middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET + '-admin');
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }
}

// ========== USER API ==========

app.post('/api/user/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (username.length < 3 || password.length < 3) return res.status(400).json({ error: 'Min 3 characters' });

    const existing = await querySingle('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: 'Username already exists' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const extCode = 'UZ' + Math.random().toString(36).substring(2, 8).toUpperCase();
    await run('INSERT INTO users (username, password, ext_code) VALUES (?, ?, ?)', [username, hashedPassword, extCode]);

    res.json({ success: true, message: 'Registration successful' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/user/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = await querySingle('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true, token,
      user: {
        id: user.id, username: user.username, vip_level: user.vip_level,
        balance: user.balance, total_commission: user.total_commission, ext_code: user.ext_code
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/user/info', authMiddleware, async (req, res) => {
  try {
    const user = await querySingle('SELECT id, username, vip_level, balance, total_commission, ext_code, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const todayOrders = await querySingle(
      "SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND date(created_at) = date('now')", [req.user.id]
    );
    const vipLevel = await querySingle('SELECT * FROM vip_levels WHERE level = ?', [user.vip_level]);

    res.json({ ...user, today_orders: todayOrders.count, vip_info: vipLevel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== HOME API ==========

app.get('/api/home', async (req, res) => {
  try {
    const vipLevels = await query('SELECT * FROM vip_levels ORDER BY level ASC');
    const newProducts = await query('SELECT * FROM products ORDER BY id DESC LIMIT 6');
    const commissions = await query('SELECT * FROM commissions ORDER BY created_at DESC LIMIT 20');

    res.json({ vip_levels: vipLevels, new_products: newProducts, commissions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== PRODUCTS API ==========

app.get('/api/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const category = req.query.category || '';

    let products, total;
    if (category) {
      products = await query('SELECT * FROM products WHERE category = ? ORDER BY id DESC LIMIT ? OFFSET ?', [category, limit, offset]);
      const countRes = await querySingle('SELECT COUNT(*) as count FROM products WHERE category = ?', [category]);
      total = countRes.count;
    } else {
      products = await query('SELECT * FROM products ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
      const countRes = await querySingle('SELECT COUNT(*) as count FROM products');
      total = countRes.count;
    }

    res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== ORDER API ==========

app.post('/api/order/grab', authMiddleware, async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) return res.status(400).json({ error: 'Product ID required' });

    const user = await querySingle('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const vipLevel = await querySingle('SELECT * FROM vip_levels WHERE level = ?', [user.vip_level]);
    if (!vipLevel) return res.status(400).json({ error: 'VIP level not found' });

    const todayOrders = await querySingle(
      "SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND date(created_at) = date('now')", [req.user.id]
    );
    if (todayOrders.count >= vipLevel.order_limit) {
      return res.status(400).json({ error: `Daily order limit reached (${vipLevel.order_limit})` });
    }

    const product = await querySingle('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const commissionRate = 0.03 + Math.random() * 0.05;
    const commission = Math.round(product.price * commissionRate * 100) / 100;

    await run('INSERT INTO orders (user_id, product_id, status, commission) VALUES (?, ?, ?, ?)',
      [req.user.id, product_id, 'completed', commission]);

    await run('UPDATE users SET balance = balance + ?, total_commission = total_commission + ? WHERE id = ?',
      [commission, commission, req.user.id]);

    const maskedName = user.username.substring(0, 3) + '***';
    await run('INSERT INTO commissions (username_display, amount) VALUES (?, ?)', [maskedName, commission]);

    await run("INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, ?)",
      [req.user.id, 'commission', commission, 'completed']);

    res.json({ success: true, message: 'Order grabbed successfully!', commission, product: product.name });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const orders = await query(`
      SELECT o.*, p.name as product_name, p.price as product_price, p.image as product_image
      FROM orders o JOIN products p ON o.product_id = p.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC LIMIT ? OFFSET ?
    `, [req.user.id, limit, offset]);

    const totalRes = await querySingle('SELECT COUNT(*) as count FROM orders WHERE user_id = ?', [req.user.id]);

    res.json({ orders, total: totalRes.count, page, totalPages: Math.ceil(totalRes.count / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== RECHARGE & WITHDRAWAL ==========

app.post('/api/recharge', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    await run("INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, ?)",
      [req.user.id, 'recharge', amount, 'completed']);
    await run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, req.user.id]);

    res.json({ success: true, message: `Recharged $${amount} successfully` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/withdrawal', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const user = await querySingle('SELECT balance FROM users WHERE id = ?', [req.user.id]);
    if (user.balance < amount) return res.status(400).json({ error: 'Insufficient balance' });

    await run("INSERT INTO transactions (user_id, type, amount, status) VALUES (?, ?, ?, 'pending')",
      [req.user.id, 'withdrawal', amount]);
    await run('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, req.user.id]);

    res.json({ success: true, message: `Withdrawal request for $${amount} submitted` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== COMMISSION LIST ==========

app.get('/api/commission/list', async (req, res) => {
  try {
    const commissions = await query('SELECT * FROM commissions ORDER BY created_at DESC LIMIT 50');
    res.json({ commissions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== ADMIN API ==========

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await querySingle('SELECT * FROM admins WHERE username = ?', [username]);
    if (!admin || !bcrypt.compareSync(password, admin.password)) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin' }, JWT_SECRET + '-admin', { expiresIn: '24h' });
    res.json({ success: true, token, username: admin.username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/stats', adminAuthMiddleware, async (req, res) => {
  try {
    const totalUsers = (await querySingle('SELECT COUNT(*) as count FROM users')).count;
    const totalOrders = (await querySingle('SELECT COUNT(*) as count FROM orders')).count;
    const totalRecharge = (await querySingle("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='recharge' AND status='completed'")).total;
    const totalWithdrawal = (await querySingle("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='withdrawal' AND status='completed'")).total;
    const totalCommission = (await querySingle("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='commission' AND status='completed'")).total;
    const todayOrders = (await querySingle("SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now')")).count;
    const todayRecharge = (await querySingle("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type='recharge' AND date(created_at)=date('now') AND status='completed'")).total;
    const pendingWithdrawals = (await querySingle("SELECT COUNT(*) as count FROM transactions WHERE type='withdrawal' AND status='pending'")).count;
    const ordersByStatus = await query('SELECT status, COUNT(*) as count FROM orders GROUP BY status');

    res.json({
      total_users: totalUsers, total_orders: totalOrders, total_recharge: totalRecharge,
      total_withdrawal: totalWithdrawal, total_commission: totalCommission,
      today_orders: todayOrders, today_recharge: todayRecharge,
      pending_withdrawals: pendingWithdrawals, orders_by_status: ordersByStatus
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/users', adminAuthMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const users = await query(`
      SELECT u.*,
        (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as order_count,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = u.id AND type='recharge' AND status='completed') as total_recharge,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = u.id AND type='withdrawal' AND status='completed') as total_withdrawal
      FROM users u ORDER BY u.created_at DESC LIMIT ? OFFSET ?
    `, [limit, offset]);

    const total = (await querySingle('SELECT COUNT(*) as count FROM users')).count;
    res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/orders', adminAuthMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const orders = await query(`
      SELECT o.*, p.name as product_name, p.price as product_price, p.image as product_image, u.username as user_name
      FROM orders o JOIN products p ON o.product_id = p.id JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC LIMIT ? OFFSET ?
    `, [limit, offset]);

    const total = (await querySingle('SELECT COUNT(*) as count FROM orders')).count;
    res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/transactions', adminAuthMiddleware, async (req, res) => {
  try {
    const status = req.query.status || '';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let transactions, total;
    if (status && status !== 'all') {
      transactions = await query(`
        SELECT t.*, u.username FROM transactions t JOIN users u ON t.user_id = u.id
        WHERE t.status = ? ORDER BY t.created_at DESC LIMIT ? OFFSET ?
      `, [status, limit, offset]);
      total = (await querySingle("SELECT COUNT(*) as count FROM transactions WHERE status = ?", [status])).count;
    } else {
      transactions = await query(`
        SELECT t.*, u.username FROM transactions t JOIN users u ON t.user_id = u.id
        ORDER BY t.created_at DESC LIMIT ? OFFSET ?
      `, [limit, offset]);
      total = (await querySingle('SELECT COUNT(*) as count FROM transactions')).count;
    }

    res.json({ transactions, total, page, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/withdrawal/approve', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.body;
    await run("UPDATE transactions SET status='completed' WHERE id=? AND type='withdrawal'", [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/withdrawal/reject', adminAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.body;
    const tx = await querySingle("SELECT * FROM transactions WHERE id = ? AND type='withdrawal'", [id]);
    if (tx) {
      await run("UPDATE transactions SET status='rejected' WHERE id=?", [id]);
      await run('UPDATE users SET balance = balance + ? WHERE id = ?', [tx.amount, tx.user_id]);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ========== SERVE STATIC ==========

app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/frontend', express.static(path.join(__dirname, 'frontend')));

app.get('/', (req, res) => {
  res.redirect('/frontend');
});

// ========== START ==========

initServer().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log('');
    console.log('🚀 UZUM Platform is running!');
    console.log('────────────────────────────────');
    console.log(`📱 User Frontend:  http://localhost:${PORT}/frontend`);
    console.log(`⚙️  Admin Panel:   http://localhost:${PORT}/admin`);
    console.log(`🔑 Test User:     testuser / test123`);
    console.log(`🔑 Admin:         admin / admin123`);
    console.log('────────────────────────────────');
  });
}).catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
