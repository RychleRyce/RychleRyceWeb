const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const SQLiteStore = require('connect-sqlite3')(session);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session middleware
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: './data'
    }),
    secret: process.env.SESSION_SECRET || 'rychle-ryce-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Initialize database
const db = new sqlite3.Database('./data/database.db');

// Create tables
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        area TEXT,
        tools TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Orders table
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER,
        worker_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        work_type TEXT NOT NULL,
        address TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        description TEXT,
        estimated_price INTEGER,
        has_tools BOOLEAN DEFAULT 0,
        photos TEXT,
        status TEXT DEFAULT 'pending',
        rating INTEGER,
        feedback TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users (id),
        FOREIGN KEY (worker_id) REFERENCES users (id)
    )`);

    // Create admin user if not exists
    const adminEmail = 'admin@rychleryce.cz';
    const adminPassword = 'admin123';
    
    db.get("SELECT id FROM users WHERE email = ?", [adminEmail], (err, row) => {
        if (!row) {
            bcrypt.hash(adminPassword, 10, (err, hash) => {
                if (!err) {
                    db.run("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", 
                        ['Admin', adminEmail, hash, 'admin']);
                }
            });
        }
    });
});

// Helper functions
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

const requireRole = (role) => {
    return (req, res, next) => {
        if (req.session.role !== role) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        next();
    };
};

// Routes

// Static file routes
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

// API Routes

// Authentication
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, phone, password, role, area, tools } = req.body;
        
        // Check if user already exists
        db.get("SELECT id FROM users WHERE email = ?", [email], async (err, row) => {
            if (row) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            
            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);
            const toolsStr = tools ? tools.join(',') : null;
            
            // Insert new user
            db.run("INSERT INTO users (name, email, phone, password, role, area, tools) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [name, email, phone, hashedPassword, role, area, toolsStr], function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }
                    res.json({ message: 'User registered successfully', userId: this.lastID });
                });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        req.session.userId = user.id;
        req.session.name = user.name;
        req.session.email = user.email;
        req.session.role = user.role;
        
        res.json({ 
            message: 'Login successful', 
            role: user.role,
            name: user.name 
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logout successful' });
    });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({
            authenticated: true,
            userId: req.session.userId,
            name: req.session.name,
            email: req.session.email,
            role: req.session.role
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Orders
app.post('/api/orders', requireAuth, upload.array('photos', 3), (req, res) => {
    const {
        customer_name,
        customer_email,
        customer_phone,
        work_type,
        address,
        latitude,
        longitude,
        description,
        has_tools
    } = req.body;
    
    // Calculate estimated price
    const priceRates = {
        'sekani_travy': 500,
        'strhani_stromu': 800,
        'natrani_plotu': 600,
        'jina_prace': 400
    };
    
    const estimated_price = priceRates[work_type] || 400;
    
    // Handle photo uploads
    const photos = req.files ? req.files.map(file => file.filename).join(',') : '';
    
    db.run(`INSERT INTO orders (
        customer_id, customer_name, customer_email, customer_phone,
        work_type, address, latitude, longitude, description,
        estimated_price, has_tools, photos
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
        req.session.userId, customer_name, customer_email, customer_phone,
        work_type, address, latitude, longitude, description,
        estimated_price, has_tools === 'on' ? 1 : 0, photos
    ], function(err) {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Order created successfully', orderId: this.lastID });
    });
});

app.get('/api/my-orders', requireAuth, (req, res) => {
    const query = req.session.role === 'customer' 
        ? "SELECT o.*, w.name as worker_name, w.phone as worker_phone FROM orders o LEFT JOIN users w ON o.worker_id = w.id WHERE o.customer_id = ? ORDER BY o.created_at DESC"
        : "SELECT o.*, c.name as customer_name FROM orders o LEFT JOIN users c ON o.customer_id = c.id WHERE o.worker_id = ? ORDER BY o.created_at DESC";
    
    db.all(query, [req.session.userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.get('/api/available-orders', requireAuth, requireRole('worker'), (req, res) => {
    db.all("SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.post('/api/orders/:id/accept', requireAuth, requireRole('worker'), (req, res) => {
    const orderId = req.params.id;
    
    db.run("UPDATE orders SET worker_id = ?, status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'",
        [req.session.userId, orderId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(400).json({ error: 'Order not available' });
            }
            res.json({ message: 'Order accepted successfully' });
        });
});

app.post('/api/orders/:id/complete', requireAuth, requireRole('worker'), (req, res) => {
    const orderId = req.params.id;
    
    db.run("UPDATE orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND worker_id = ?",
        [orderId, req.session.userId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(400).json({ error: 'Order not found' });
            }
            res.json({ message: 'Order completed successfully' });
        });
});

app.post('/api/orders/:id/rate', requireAuth, requireRole('customer'), (req, res) => {
    const orderId = req.params.id;
    const { rating, feedback } = req.body;
    
    db.run("UPDATE orders SET rating = ?, feedback = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND customer_id = ? AND status = 'completed'",
        [rating, feedback, orderId, req.session.userId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                return res.status(400).json({ error: 'Order not found or cannot be rated' });
            }
            res.json({ message: 'Rating submitted successfully' });
        });
});

// Admin routes
app.get('/api/admin/orders', requireAuth, requireRole('admin'), (req, res) => {
    db.all(`SELECT o.*, 
            c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
            w.name as worker_name, w.email as worker_email, w.phone as worker_phone
            FROM orders o 
            LEFT JOIN users c ON o.customer_id = c.id 
            LEFT JOIN users w ON o.worker_id = w.id 
            ORDER BY o.created_at DESC`, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

app.get('/api/admin/workers', requireAuth, requireRole('admin'), (req, res) => {
    db.all("SELECT * FROM users WHERE role = 'worker' ORDER BY created_at DESC", (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(rows);
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large' });
        }
    }
    res.status(500).json({ error: 'Something went wrong!' });
});

// Create necessary directories
const dirs = ['./data', './public/uploads'];
dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});