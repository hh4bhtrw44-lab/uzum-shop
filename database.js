const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'uzum.db');

async function initDatabase() {
  const SQL = await initSqlJs();
  let db;

  // Load existing or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      vip_level INTEGER DEFAULT 1,
      balance REAL DEFAULT 0,
      total_commission REAL DEFAULT 0,
      ext_code TEXT UNIQUE,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      image TEXT DEFAULT '📦',
      category TEXT DEFAULT 'general',
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      commission REAL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('recharge', 'withdrawal', 'commission')),
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username_display TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vip_levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level INTEGER UNIQUE NOT NULL,
      order_limit INTEGER NOT NULL DEFAULT 5,
      upgrade_price REAL DEFAULT 0
    );
  `);

  // Seed default admin
  const adminCount = db.exec("SELECT COUNT(*) as count FROM admins");
  const adminCountVal = adminCount.length > 0 ? adminCount[0].values[0][0] : 0;
  if (adminCountVal === 0) {
    const hashedPwd = bcrypt.hashSync('admin123', 10);
    db.run('INSERT INTO admins (username, password) VALUES (?, ?)', ['admin', hashedPwd]);
    console.log('✅ Default admin created: admin / admin123');
  }

  // Seed VIP levels
  const vipCount = db.exec("SELECT COUNT(*) as count FROM vip_levels");
  const vipCountVal = vipCount.length > 0 ? vipCount[0].values[0][0] : 0;
  if (vipCountVal === 0) {
    const levels = [
      [1, 5, 0],
      [2, 15, 199],
      [3, 30, 499],
      [4, 60, 999],
      [5, 100, 1999],
    ];
    const stmt = db.prepare('INSERT INTO vip_levels (level, order_limit, upgrade_price) VALUES (?, ?, ?)');
    for (const [level, limit, price] of levels) {
      stmt.run([level, limit, price]);
    }
    stmt.free();
    console.log('✅ VIP levels seeded');
  }

  // Seed sample products
  const productCount = db.exec("SELECT COUNT(*) as count FROM products");
  const productCountVal = productCount.length > 0 ? productCount[0].values[0][0] : 0;
  if (productCountVal === 0) {
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
    const stmt = db.prepare('INSERT INTO products (name, price, image, category) VALUES (?, ?, ?, ?)');
    for (const [name, price, image, category] of products) {
      stmt.run([name, price, image, category]);
    }
    stmt.free();
    console.log('✅ Sample products seeded');
  }

  // Seed sample commissions
  const commCount = db.exec("SELECT COUNT(*) as count FROM commissions");
  const commCountVal = commCount.length > 0 ? commCount[0].values[0][0] : 0;
  if (commCountVal === 0) {
    const commissions = [
      ['Alex***', 156.80],
      ['Maria***', 89.50],
      ['John***', 234.00],
      ['Sophie***', 67.90],
      ['David***', 412.30],
      ['Emma***', 123.45],
      ['Chris***', 78.60],
      ['Lisa***', 345.00],
      ['Tom***', 56.70],
      ['Anna***', 198.20],
      ['Mike***', 890.00],
      ['Sarah***', 234.50],
      ['Kevin***', 567.80],
      ['Jessica***', 45.60],
      ['Ryan***', 678.90],
    ];
    const stmt = db.prepare('INSERT INTO commissions (username_display, amount) VALUES (?, ?)');
    for (const [name, amount] of commissions) {
      stmt.run([name, amount]);
    }
    stmt.free();
    console.log('✅ Sample commissions seeded');
  }

  // Create a sample user
  const userCount = db.exec("SELECT COUNT(*) as count FROM users");
  const userCountVal = userCount.length > 0 ? userCount[0].values[0][0] : 0;
  if (userCountVal === 0) {
    const hashedPwd = bcrypt.hashSync('test123', 10);
    const extCode = 'UZ' + Math.random().toString(36).substring(2, 8).toUpperCase();
    db.run('INSERT INTO users (username, password, vip_level, balance, ext_code) VALUES (?, ?, ?, ?, ?)',
      ['testuser', hashedPwd, 2, 5000, extCode]);
    console.log('✅ Sample user created: testuser / test123');
  }

  // Save to disk
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  db.close();

  console.log('✅ Database initialized at', DB_PATH);
}

initDatabase().catch(err => {
  console.error('Database init failed:', err);
  process.exit(1);
});
