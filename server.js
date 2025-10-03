// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = 3000;

// 确保 uploads 文件夹存在
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // 允许访问 index.html 和上传的文件
app.use('/uploads', express.static('uploads'));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldName + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ========== 用户相关 API ==========
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });

  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
    if (row) return res.status(400).json({ error: '用户名已存在' });
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, password], function(err) {
      if (err) return res.status(500).json({ error: '注册失败' });
      res.json({ success: true });
    });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, user) => {
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });
    if (user.isBanned) return res.status(403).json({ error: '账号已被封禁' });
    res.json({
      success: true,
      username: user.username,
      isAdmin: user.isAdmin === 1
    });
  });
});

// ========== 留言相关 API ==========
app.get('/api/messages', (req, res) => {
  db.all(`SELECT * FROM messages ORDER BY id DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: '获取留言失败' });
    res.json(rows);
  });
});

app.post('/api/messages', (req, res) => {
  const { author, content } = req.body;
  const timestamp = new Date().toLocaleString('zh-CN');
  if (!author || !content) return res.status(400).json({ error: '内容不能为空' });

  db.run(`INSERT INTO messages (author, content, timestamp) VALUES (?, ?, ?)`,
    [author, content, timestamp],
    function(err) {
      if (err) return res.status(500).json({ error: '留言失败' });
      res.json({ success: true });
    }
  );
});

app.delete('/api/messages/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM messages WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: '删除失败' });
    res.json({ success: true });
  });
});

app.post('/api/messages/:id/pin', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE messages SET isPinned = 1 - isPinned WHERE id = ?`, [id], function(err) {
    if (err) return res.status(500).json({ error: '操作失败' });
    res.json({ success: true });
  });
});

// ========== 文件上传 ==========
app.post('/api/upload', upload.array('files'), (req, res) => {
  const files = req.files;
  if (!files || files.length === 0) return res.status(400).json({ error: '没有文件' });

  const now = new Date().toISOString();
  const fileRecords = files.map(file => {
    db.run(`INSERT INTO files (name, path, uploadTime) VALUES (?, ?, ?)`,
      [file.originalname, '/uploads/' + file.filename, now]
    );
    return { name: file.originalname, data: '/uploads/' + file.filename };
  });

  res.json({ success: true, files: fileRecords });
});

app.get('/api/files', (req, res) => {
  db.all(`SELECT * FROM files ORDER BY id DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: '获取文件失败' });
    res.json(rows);
  });
});

app.delete('/api/files/:id', (req, res) => {
  const { id } = req.params;
  db.get(`SELECT path FROM files WHERE id = ?`, [id], (err, row) => {
    if (row) {
      const filePath = path.join(__dirname, row.path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.run(`DELETE FROM files WHERE id = ?`, [id], function() {
      res.json({ success: true });
    });
  });
});

// ========== 用户管理（仅管理员） ==========
app.get('/api/users', (req, res) => {
  db.all(`SELECT username, isBanned FROM users WHERE isAdmin = 0`, (err, rows) => {
    if (err) return res.status(500).json({ error: '获取用户失败' });
    res.json(rows);
  });
});

app.post('/api/users/action', (req, res) => {
  const { username, action } = req.body;
  switch (action) {
    case 'ban':
      db.run(`UPDATE users SET isBanned = 1 WHERE username = ?`, [username]);
      db.run(`DELETE FROM messages WHERE author = ?`, [username]);
      break;
    case 'unban':
      db.run(`UPDATE users SET isBanned = 0 WHERE username = ?`, [username]);
      break;
    case 'delete':
      db.run(`DELETE FROM users WHERE username = ?`, [username]);
      db.run(`DELETE FROM messages WHERE author = ?`, [username]);
      break;
  }
  res.json({ success: true });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`✅ 后端已启动！`);
  console.log(`🌐 打开 http://localhost:${PORT} 查看你的网站`);
  console.log(`🔧 初始管理员账号：用户名 admin，密码 admin123`);
});