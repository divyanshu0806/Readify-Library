// server.js - Main Express Server
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'readify_library',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connected successfully');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
    });

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Check if user is librarian
const isLibrarian = (req, res, next) => {
    if (req.user.userType !== 'librarian') {
        return res.status(403).json({ error: 'Access denied. Librarian privileges required.' });
    }
    next();
};

// ==================== AUTH ROUTES ====================

// Register new user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, fullName, userType, phone, address } = req.body;

        // Validate required fields
        if (!username || !email || !password || !fullName || !userType) {
            return res.status(400).json({ error: 'All required fields must be provided' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert user
        const [result] = await pool.execute(
            'INSERT INTO users (username, email, password_hash, full_name, user_type, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [username, email, passwordHash, fullName, userType, phone || null, address || null]
        );

        res.status(201).json({
            message: 'User registered successfully',
            userId: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Find user
        const [users] = await pool.execute(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Check if user is active
        if (user.status !== 'active') {
            return res.status(403).json({ error: 'Account is inactive or suspended' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login
        await pool.execute(
            'UPDATE users SET last_login = NOW() WHERE user_id = ?',
            [user.user_id]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.user_id, userType: user.user_type, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                userId: user.user_id,
                username: user.username,
                email: user.email,
                fullName: user.full_name,
                userType: user.user_type
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT user_id, username, email, full_name, user_type, phone, address, created_at FROM users WHERE user_id = ?',
            [req.user.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(users[0]);
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// ==================== BOOK ROUTES ====================

// Get all books with filters
app.get('/api/books', async (req, res) => {
    try {
        const { title, author, genre, status, search } = req.query;
        let query = 'SELECT * FROM books WHERE 1=1';
        const params = [];

        if (title) {
            query += ' AND title LIKE ?';
            params.push(`%${title}%`);
        }

        if (author) {
            query += ' AND author LIKE ?';
            params.push(`%${author}%`);
        }

        if (genre) {
            query += ' AND genre = ?';
            params.push(genre);
        }

        if (status === 'available') {
            query += ' AND available_copies > 0';
        } else if (status === 'borrowed') {
            query += ' AND available_copies = 0';
        }

        if (search) {
            query += ' AND (title LIKE ? OR author LIKE ? OR genre LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        query += ' ORDER BY title ASC';

        const [books] = await pool.execute(query, params);
        res.json(books);
    } catch (error) {
        console.error('Books fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch books' });
    }
});

// Get single book by ID
app.get('/api/books/:id', async (req, res) => {
    try {
        const [books] = await pool.execute(
            'SELECT * FROM books WHERE book_id = ?',
            [req.params.id]
        );

        if (books.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        // Get average rating and reviews
        const [ratings] = await pool.execute(
            'SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE book_id = ?',
            [req.params.id]
        );

        res.json({
            ...books[0],
            avg_rating: ratings[0].avg_rating || 0,
            review_count: ratings[0].review_count
        });
    } catch (error) {
        console.error('Book fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch book' });
    }
});

// Add new book (librarian only)
app.post('/api/books', authenticateToken, isLibrarian, async (req, res) => {
    try {
        const { title, author, isbn, genre, publicationYear, publisher, totalCopies, description, imageUrl } = req.body;

        const [result] = await pool.execute(
            'INSERT INTO books (title, author, isbn, genre, publication_year, publisher, total_copies, available_copies, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [title, author, isbn, genre, publicationYear, publisher, totalCopies, totalCopies, description, imageUrl]
        );

        res.status(201).json({
            message: 'Book added successfully',
            bookId: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'ISBN already exists' });
        }
        console.error('Book add error:', error);
        res.status(500).json({ error: 'Failed to add book' });
    }
});

// Update book (librarian only)
app.put('/api/books/:id', authenticateToken, isLibrarian, async (req, res) => {
    try {
        const { title, author, isbn, genre, publicationYear, publisher, totalCopies, description, imageUrl } = req.body;

        const [result] = await pool.execute(
            'UPDATE books SET title = ?, author = ?, isbn = ?, genre = ?, publication_year = ?, publisher = ?, total_copies = ?, description = ?, image_url = ? WHERE book_id = ?',
            [title, author, isbn, genre, publicationYear, publisher, totalCopies, description, imageUrl, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        res.json({ message: 'Book updated successfully' });
    } catch (error) {
        console.error('Book update error:', error);
        res.status(500).json({ error: 'Failed to update book' });
    }
});

// Delete book (librarian only)
app.delete('/api/books/:id', authenticateToken, isLibrarian, async (req, res) => {
    try {
        const [result] = await pool.execute(
            'DELETE FROM books WHERE book_id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        res.json({ message: 'Book deleted successfully' });
    } catch (error) {
        console.error('Book delete error:', error);
        res.status(500).json({ error: 'Failed to delete book' });
    }
});

// ==================== BORROWING ROUTES ====================

// Borrow a book
app.post('/api/borrow', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { bookId } = req.body;
        const userId = req.user.userId;

        // Check if book is available
        const [books] = await connection.execute(
            'SELECT * FROM books WHERE book_id = ? FOR UPDATE',
            [bookId]
        );

        if (books.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Book not found' });
        }

        if (books[0].available_copies <= 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'Book is not available' });
        }

        // Check if user already borrowed this book
        const [existing] = await connection.execute(
            'SELECT * FROM borrowing_records WHERE user_id = ? AND book_id = ? AND status = "borrowed"',
            [userId, bookId]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.status(400).json({ error: 'You have already borrowed this book' });
        }

        // Create borrowing record (14 days borrowing period)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 14);

        await connection.execute(
            'INSERT INTO borrowing_records (user_id, book_id, due_date) VALUES (?, ?, ?)',
            [userId, bookId, dueDate]
        );

        // Update available copies
        await connection.execute(
            'UPDATE books SET available_copies = available_copies - 1 WHERE book_id = ?',
            [bookId]
        );

        await connection.commit();
        res.json({
            message: 'Book borrowed successfully',
            dueDate: dueDate.toISOString().split('T')[0]
        });
    } catch (error) {
        await connection.rollback();
        console.error('Borrow error:', error);
        res.status(500).json({ error: 'Failed to borrow book' });
    } finally {
        connection.release();
    }
});

// Return a book
app.post('/api/return', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const { bookId } = req.body;
        const userId = req.user.userId;

        // Find borrowing record
        const [records] = await connection.execute(
            'SELECT * FROM borrowing_records WHERE user_id = ? AND book_id = ? AND status = "borrowed" FOR UPDATE',
            [userId, bookId]
        );

        if (records.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'No active borrowing record found' });
        }

        const record = records[0];
        const returnDate = new Date();
        const dueDate = new Date(record.due_date);
        
        // Calculate fine if overdue (₹10 per day)
        let fine = 0;
        if (returnDate > dueDate) {
            const daysOverdue = Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24));
            fine = daysOverdue * 10;
        }

        // Update borrowing record
        await connection.execute(
            'UPDATE borrowing_records SET return_date = NOW(), status = "returned", fine_amount = ? WHERE record_id = ?',
            [fine, record.record_id]
        );

        // Update available copies
        await connection.execute(
            'UPDATE books SET available_copies = available_copies + 1 WHERE book_id = ?',
            [bookId]
        );

        await connection.commit();
        res.json({
            message: 'Book returned successfully',
            fine: fine,
            daysOverdue: fine > 0 ? Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24)) : 0
        });
    } catch (error) {
        await connection.rollback();
        console.error('Return error:', error);
        res.status(500).json({ error: 'Failed to return book' });
    } finally {
        connection.release();
    }
});

// Get user's borrowing history
app.get('/api/borrowing/history', authenticateToken, async (req, res) => {
    try {
        const [records] = await pool.execute(
            `SELECT br.*, b.title, b.author, b.genre, b.image_url 
             FROM borrowing_records br 
             JOIN books b ON br.book_id = b.book_id 
             WHERE br.user_id = ? 
             ORDER BY br.borrow_date DESC`,
            [req.user.userId]
        );

        res.json(records);
    } catch (error) {
        console.error('History fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch borrowing history' });
    }
});

// Get currently borrowed books
app.get('/api/borrowing/current', authenticateToken, async (req, res) => {
    try {
        const [records] = await pool.execute(
            `SELECT br.*, b.title, b.author, b.genre, b.image_url 
             FROM borrowing_records br 
             JOIN books b ON br.book_id = b.book_id 
             WHERE br.user_id = ? AND br.status = 'borrowed' 
             ORDER BY br.due_date ASC`,
            [req.user.userId]
        );

        res.json(records);
    } catch (error) {
        console.error('Current books fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch current books' });
    }
});

// Get user statistics
app.get('/api/users/stats', authenticateToken, async (req, res) => {
    try {
        const [stats] = await pool.execute(
            `SELECT 
                COUNT(CASE WHEN status = 'borrowed' THEN 1 END) as currently_borrowed,
                COUNT(CASE WHEN status = 'returned' THEN 1 END) as total_returned,
                COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
                COALESCE(SUM(fine_amount), 0) as total_fines
             FROM borrowing_records 
             WHERE user_id = ?`,
            [req.user.userId]
        );

        res.json(stats[0]);
    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// ==================== LIBRARIAN ROUTES ====================

// Get all borrowing records (librarian only)
app.get('/api/admin/borrowing', authenticateToken, isLibrarian, async (req, res) => {
    try {
        const { status } = req.query;
        let query = `
            SELECT br.*, b.title, b.author, u.username, u.full_name, u.email 
            FROM borrowing_records br 
            JOIN books b ON br.book_id = b.book_id 
            JOIN users u ON br.user_id = u.user_id 
            WHERE 1=1
        `;
        const params = [];

        if (status) {
            query += ' AND br.status = ?';
            params.push(status);
        }

        query += ' ORDER BY br.borrow_date DESC';

        const [records] = await pool.execute(query, params);
        res.json(records);
    } catch (error) {
        console.error('Admin borrowing fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch borrowing records' });
    }
});

// Get all users (librarian only)
app.get('/api/admin/users', authenticateToken, isLibrarian, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT user_id, username, email, full_name, user_type, phone, status, created_at, last_login FROM users ORDER BY created_at DESC'
        );

        res.json(users);
    } catch (error) {
        console.error('Users fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get dashboard statistics (librarian only)
app.get('/api/admin/dashboard', authenticateToken, isLibrarian, async (req, res) => {
    try {
        // Total books
        const [totalBooks] = await pool.execute(
            'SELECT COUNT(*) as total, SUM(total_copies) as total_copies, SUM(available_copies) as available_copies FROM books'
        );

        // Total users
        const [totalUsers] = await pool.execute(
            'SELECT COUNT(*) as total, COUNT(CASE WHEN user_type = "student" THEN 1 END) as students, COUNT(CASE WHEN user_type = "librarian" THEN 1 END) as librarians FROM users'
        );

        // Borrowing statistics
        const [borrowingStats] = await pool.execute(
            `SELECT 
                COUNT(CASE WHEN status = 'borrowed' THEN 1 END) as currently_borrowed,
                COUNT(CASE WHEN status = 'returned' THEN 1 END) as total_returned,
                COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue,
                COALESCE(SUM(fine_amount), 0) as total_fines
             FROM borrowing_records`
        );

        // Recent activities
        const [recentActivities] = await pool.execute(
            `SELECT br.*, b.title, u.username 
             FROM borrowing_records br 
             JOIN books b ON br.book_id = b.book_id 
             JOIN users u ON br.user_id = u.user_id 
             ORDER BY br.borrow_date DESC 
             LIMIT 10`
        );

        res.json({
            books: totalBooks[0],
            users: totalUsers[0],
            borrowing: borrowingStats[0],
            recentActivities
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// Update user status (librarian only)
app.patch('/api/admin/users/:id/status', authenticateToken, isLibrarian, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['active', 'inactive', 'suspended'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const [result] = await pool.execute(
            'UPDATE users SET status = ? WHERE user_id = ?',
            [status, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User status updated successfully' });
    } catch (error) {
        console.error('User status update error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

// ==================== REVIEW ROUTES ====================

// Add review
app.post('/api/reviews', authenticateToken, async (req, res) => {
    try {
        const { bookId, rating, reviewText } = req.body;
        const userId = req.user.userId;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        // Check if user has borrowed this book
        const [borrowed] = await pool.execute(
            'SELECT * FROM borrowing_records WHERE user_id = ? AND book_id = ?',
            [userId, bookId]
        );

        if (borrowed.length === 0) {
            return res.status(403).json({ error: 'You can only review books you have borrowed' });
        }

        await pool.execute(
            'INSERT INTO reviews (user_id, book_id, rating, review_text) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE rating = ?, review_text = ?',
            [userId, bookId, rating, reviewText, rating, reviewText]
        );

        res.status(201).json({ message: 'Review added successfully' });
    } catch (error) {
        console.error('Review add error:', error);
        res.status(500).json({ error: 'Failed to add review' });
    }
});

// Get reviews for a book
app.get('/api/reviews/:bookId', async (req, res) => {
    try {
        const [reviews] = await pool.execute(
            `SELECT r.*, u.username, u.full_name 
             FROM reviews r 
             JOIN users u ON r.user_id = u.user_id 
             WHERE r.book_id = ? 
             ORDER BY r.review_date DESC`,
            [req.params.bookId]
        );

        res.json(reviews);
    } catch (error) {
        console.error('Reviews fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

// ==================== RESERVATION ROUTES ====================

// Create reservation
app.post('/api/reservations', authenticateToken, async (req, res) => {
    try {
        const { bookId } = req.body;
        const userId = req.user.userId;

        // Check if book is unavailable
        const [books] = await pool.execute(
            'SELECT * FROM books WHERE book_id = ?',
            [bookId]
        );

        if (books.length === 0) {
            return res.status(404).json({ error: 'Book not found' });
        }

        if (books[0].available_copies > 0) {
            return res.status(400).json({ error: 'Book is available. Please borrow directly.' });
        }

        // Check for existing reservation
        const [existing] = await pool.execute(
            'SELECT * FROM reservations WHERE user_id = ? AND book_id = ? AND status = "pending"',
            [userId, bookId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'You already have a pending reservation for this book' });
        }

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        await pool.execute(
            'INSERT INTO reservations (user_id, book_id, expiry_date) VALUES (?, ?, ?)',
            [userId, bookId, expiryDate]
        );

        res.status(201).json({ message: 'Reservation created successfully' });
    } catch (error) {
        console.error('Reservation error:', error);
        res.status(500).json({ error: 'Failed to create reservation' });
    }
});

// Get user reservations
app.get('/api/reservations', authenticateToken, async (req, res) => {
    try {
        const [reservations] = await pool.execute(
            `SELECT res.*, b.title, b.author, b.genre 
             FROM reservations res 
             JOIN books b ON res.book_id = b.book_id 
             WHERE res.user_id = ? AND res.status = 'pending' 
             ORDER BY res.reservation_date DESC`,
            [req.user.userId]
        );

        res.json(reservations);
    } catch (error) {
        console.error('Reservations fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch reservations' });
    }
});

// ==================== SEARCH & RECOMMENDATIONS ====================

// Advanced search
app.get('/api/search', async (req, res) => {
    try {
        const { q, type } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query required' });
        }

        let query = 'SELECT * FROM books WHERE ';
        const params = [];

        if (type === 'title') {
            query += 'title LIKE ?';
            params.push(`%${q}%`);
        } else if (type === 'author') {
            query += 'author LIKE ?';
            params.push(`%${q}%`);
        } else if (type === 'isbn') {
            query += 'isbn LIKE ?';
            params.push(`%${q}%`);
        } else {
            query += '(title LIKE ? OR author LIKE ? OR genre LIKE ? OR isbn LIKE ?)';
            params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
        }

        const [results] = await pool.execute(query, params);
        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Get popular books
app.get('/api/books/popular', async (req, res) => {
    try {
        const [books] = await pool.execute(
            `SELECT b.*, COUNT(br.record_id) as borrow_count 
             FROM books b 
             LEFT JOIN borrowing_records br ON b.book_id = br.book_id 
             GROUP BY b.book_id 
             ORDER BY borrow_count DESC 
             LIMIT 10`
        );

        res.json(books);
    } catch (error) {
        console.error('Popular books fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch popular books' });
    }
});

// Get genres
app.get('/api/genres', async (req, res) => {
    try {
        const [genres] = await pool.execute(
            'SELECT DISTINCT genre, COUNT(*) as count FROM books GROUP BY genre ORDER BY genre'
        );

        res.json(genres);
    } catch (error) {
        console.error('Genres fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ==================== SERVER START ====================

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 Readify Library Management System API`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});