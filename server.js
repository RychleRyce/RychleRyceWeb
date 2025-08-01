const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'rychle-ryce-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Multer pro upload fotek
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage, limits: { files: 3 } });

// Inicializace databáze
const db = new sqlite3.Database('database.sqlite');

// Vytvoření tabulek
db.serialize(() => {
    // Uživatelé (zákazníci, brigádníci, admin)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('customer', 'worker', 'admin')),
        name TEXT NOT NULL,
        phone TEXT,
        area TEXT,
        tools TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Objednávky
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        worker_id INTEGER,
        work_type TEXT NOT NULL,
        description TEXT,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        has_tools INTEGER DEFAULT 0,
        photos TEXT,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'completed', 'cancelled')),
        estimated_price REAL,
        rating INTEGER,
        feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users (id),
        FOREIGN KEY (worker_id) REFERENCES users (id)
    )`);

    // Vytvoření admin účtu
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (email, password, role, name, phone) 
            VALUES ('admin@rychleryce.cz', ?, 'admin', 'Administrátor', '+420123456789')`, 
            [adminPassword]);
});

// API Routes

// Registrace
app.post('/api/register', async (req, res) => {
    const { email, password, role, name, phone, area, tools } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const toolsStr = Array.isArray(tools) ? tools.join(',') : tools || '';
        
        db.run(`INSERT INTO users (email, password, role, name, phone, area, tools) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                [email, hashedPassword, role, name, phone, area, toolsStr], 
                function(err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint failed')) {
                            return res.status(400).json({ error: 'Email už je registrován' });
                        }
                        return res.status(500).json({ error: 'Chyba při registraci' });
                    }
                    res.json({ message: 'Registrace úspěšná', userId: this.lastID });
                });
    } catch (error) {
        res.status(500).json({ error: 'Chyba serveru' });
    }
});

// Přihlášení
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Chyba serveru' });
        }
        
        if (!user || !await bcrypt.compare(password, user.password)) {
            return res.status(401).json({ error: 'Špatný email nebo heslo' });
        }
        
        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.userName = user.name;
        
        res.json({ 
            message: 'Přihlášení úspěšné', 
            role: user.role,
            name: user.name,
            userId: user.id
        });
    });
});

// Odhlášení
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Chyba při odhlašování' });
        }
        res.json({ message: 'Odhlášení úspěšné' });
    });
});

// Kontrola přihlášení
app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            authenticated: true, 
            role: req.session.userRole,
            name: req.session.userName,
            userId: req.session.userId
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Vytvoření objednávky
app.post('/api/orders', upload.array('photos', 3), (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'customer') {
        return res.status(401).json({ error: 'Neautorizovaný přístup' });
    }
    
    const { work_type, description, address, latitude, longitude, has_tools } = req.body;
    const photos = req.files ? req.files.map(file => file.filename).join(',') : '';
    
    // Odhad ceny podle typu práce
    const priceEstimates = {
        'sekani_travy': 20, // Kč/m²
        'strhani_stromu': 500, // Kč/strom
        'natrani_plotu': 15, // Kč/m
        'jina_prace': 200 // Kč/hodina
    };
    const estimatedPrice = priceEstimates[work_type] || 200;
    
    db.run(`INSERT INTO orders (customer_id, work_type, description, address, latitude, longitude, has_tools, photos, estimated_price) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.session.userId, work_type, description, address, latitude, longitude, has_tools || 0, photos, estimatedPrice],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Chyba při vytváření objednávky' });
                }
                res.json({ message: 'Objednávka vytvořena', orderId: this.lastID });
            });
});

// Získání objednávek pro brigádníka
app.get('/api/available-orders', (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'worker') {
        return res.status(401).json({ error: 'Neautorizovaný přístup' });
    }
    
    db.all(`SELECT o.*, u.name as customer_name, u.phone as customer_phone 
            FROM orders o 
            JOIN users u ON o.customer_id = u.id 
            WHERE o.status = 'pending'
            ORDER BY o.created_at DESC`, [], (err, orders) => {
        if (err) {
            return res.status(500).json({ error: 'Chyba při načítání objednávek' });
        }
        res.json(orders);
    });
});

// Přijetí objednávky brigádníkem
app.post('/api/orders/:id/accept', (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'worker') {
        return res.status(401).json({ error: 'Neautorizovaný přístup' });
    }
    
    const orderId = req.params.id;
    
    db.run(`UPDATE orders SET worker_id = ?, status = 'accepted' WHERE id = ? AND status = 'pending'`,
            [req.session.userId, orderId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Chyba při přijímání objednávky' });
        }
        if (this.changes === 0) {
            return res.status(400).json({ error: 'Objednávka už není dostupná' });
        }
        res.json({ message: 'Objednávka přijata' });
    });
});

// Označení práce jako dokončené
app.post('/api/orders/:id/complete', (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'worker') {
        return res.status(401).json({ error: 'Neautorizovaný přístup' });
    }
    
    const orderId = req.params.id;
    
    db.run(`UPDATE orders SET status = 'completed' WHERE id = ? AND worker_id = ?`,
            [orderId, req.session.userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Chyba při dokončování objednávky' });
        }
        res.json({ message: 'Práce označena jako dokončená' });
    });
});

// Přidání hodnocení zákazníkem
app.post('/api/orders/:id/rate', (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'customer') {
        return res.status(401).json({ error: 'Neautorizovaný přístup' });
    }
    
    const { rating, feedback } = req.body;
    const orderId = req.params.id;
    
    db.run(`UPDATE orders SET rating = ?, feedback = ? WHERE id = ? AND customer_id = ?`,
            [rating, feedback, orderId, req.session.userId], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Chyba při přidávání hodnocení' });
        }
        res.json({ message: 'Hodnocení přidáno' });
    });
});

// Admin API - všechny objednávky
app.get('/api/admin/orders', (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(401).json({ error: 'Neautorizovaný přístup' });
    }
    
    db.all(`SELECT o.*, 
                   c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
                   w.name as worker_name, w.email as worker_email, w.phone as worker_phone
            FROM orders o 
            JOIN users c ON o.customer_id = c.id 
            LEFT JOIN users w ON o.worker_id = w.id
            ORDER BY o.created_at DESC`, [], (err, orders) => {
        if (err) {
            return res.status(500).json({ error: 'Chyba při načítání objednávek' });
        }
        res.json(orders);
    });
});

// Admin API - všichni brigádníci
app.get('/api/admin/workers', (req, res) => {
    if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(401).json({ error: 'Neautorizovaný přístup' });
    }
    
    db.all('SELECT * FROM users WHERE role = "worker" ORDER BY created_at DESC', [], (err, workers) => {
        if (err) {
            return res.status(500).json({ error: 'Chyba při načítání brigádníků' });
        }
        res.json(workers);
    });
});

// Získání objednávek uživatele
app.get('/api/my-orders', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Neautorizovaný přístup' });
    }
    
    let query = '';
    let params = [req.session.userId];
    
    if (req.session.userRole === 'customer') {
        query = `SELECT o.*, w.name as worker_name, w.phone as worker_phone 
                 FROM orders o 
                 LEFT JOIN users w ON o.worker_id = w.id 
                 WHERE o.customer_id = ? 
                 ORDER BY o.created_at DESC`;
    } else if (req.session.userRole === 'worker') {
        query = `SELECT o.*, c.name as customer_name, c.phone as customer_phone 
                 FROM orders o 
                 JOIN users c ON o.customer_id = c.id 
                 WHERE o.worker_id = ? 
                 ORDER BY o.created_at DESC`;
    }
    
    db.all(query, params, (err, orders) => {
        if (err) {
            return res.status(500).json({ error: 'Chyba při načítání objednávek' });
        }
        res.json(orders);
    });
});

// HTML Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/customer-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'customer_dashboard.html'));
});

app.get('/worker-dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'worker_dashboard.html'));
});

app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin_panel.html'));
});

app.get('/order-form', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'order_form.html'));
});

// Spuštění serveru
app.listen(PORT, () => {
    console.log(`Server běží na http://localhost:${PORT}`);
    console.log('Admin přihlášení: admin@rychleryce.cz / admin123');
});