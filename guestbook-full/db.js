// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'guestbook.db');
const db = new sqlite3.Database(dbPath);

// 创建表
db.serialize(() => {
  // 用户表
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    isAdmin BOOLEAN DEFAULT 0,
    isBanned BOOLEAN DEFAULT 0
  )`);

  // 留言表
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    isPinned BOOLEAN DEFAULT 0
  )`);

  // 文件表
  db.run(`CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    comment TEXT,
    uploadTime TEXT NOT NULL
  )`);

  // 插入初始管理员（用户名: admin, 密码: admin123）
  const adminUser = { username: 'admin', password: 'admin123', isAdmin: 1 };
  db.get(`SELECT * FROM users WHERE username = ?`, [adminUser.username], (err, row) => {
    if (!row) {
      const stmt = db.prepare(`INSERT INTO users (username, password, isAdmin) VALUES (?, ?, ?)`);
      stmt.run(adminUser.username, adminUser.password, adminUser.isAdmin);
      stmt.finalize();
      console.log('✅ 初始管理员已创建：用户名 admin，密码 admin123');
    }
  });
});

module.exports = db;