-- Create Database
CREATE DATABASE IF NOT EXISTS readify_library;
USE readify_library;

-- Users Table (Students and Librarians)
CREATE TABLE users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    user_type ENUM('student', 'librarian') NOT NULL,
    phone VARCHAR(15),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    INDEX idx_email (email),
    INDEX idx_username (username)
);

-- Books Table
CREATE TABLE books (
    book_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(100) NOT NULL,
    isbn VARCHAR(20) UNIQUE,
    genre VARCHAR(50) NOT NULL,
    publication_year INT,
    publisher VARCHAR(100),
    total_copies INT DEFAULT 1,
    available_copies INT DEFAULT 1,
    description TEXT,
    image_url VARCHAR(500),
    added_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_title (title),
    INDEX idx_author (author),
    INDEX idx_genre (genre),
    INDEX idx_isbn (isbn)
);

-- Borrowing Records Table
CREATE TABLE borrowing_records (
    record_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    borrow_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date DATE NOT NULL,
    return_date TIMESTAMP NULL,
    status ENUM('borrowed', 'returned', 'overdue') DEFAULT 'borrowed',
    fine_amount DECIMAL(10, 2) DEFAULT 0.00,
    librarian_id INT,
    notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    FOREIGN KEY (librarian_id) REFERENCES users(user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_book_id (book_id),
    INDEX idx_status (status),
    INDEX idx_borrow_date (borrow_date)
);

-- Reservations Table (for books that are currently borrowed)
CREATE TABLE reservations (
    reservation_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'fulfilled', 'cancelled') DEFAULT 'pending',
    expiry_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_book_id (book_id),
    INDEX idx_status (status)
);

-- Reviews and Ratings Table
CREATE TABLE reviews (
    review_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    book_id INT NOT NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_book_review (user_id, book_id),
    INDEX idx_book_id (book_id)
);

-- Insert Sample Users
INSERT INTO users (username, email, password_hash, full_name, user_type, phone, address) VALUES
('student1', 'student1@readify.com', '$2b$10$qwertyuiopasdfghjklzxc', 'John Doe', 'student', '9876543210', 'Kapurthala, Punjab'),
('student2', 'student2@readify.com', '$2b$10$qwertyuiopasdfghjklzxc', 'Jane Smith', 'student', '9876543211', 'Jalandhar, Punjab'),
('librarian1', 'librarian@readify.com', '$2b$10$qwertyuiopasdfghjklzxc', 'Admin User', 'librarian', '9876543212', 'Kapurthala, Punjab');

-- Insert Sample Books
INSERT INTO books (title, author, isbn, genre, publication_year, publisher, total_copies, available_copies, description, image_url) VALUES
('The Great Gatsby', 'F. Scott Fitzgerald', '978-0-7432-7356-5', 'Fiction', 1925, 'Scribner', 3, 3, 'A classic American novel set in the Jazz Age', 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=600&fit=crop'),
('To Kill a Mockingbird', 'Harper Lee', '978-0-06-112008-4', 'Fiction', 1960, 'J.B. Lippincott & Co.', 2, 2, 'A gripping tale of racial injustice and childhood innocence', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop'),
('1984', 'George Orwell', '978-0-452-28423-4', 'Fiction', 1949, 'Secker & Warburg', 4, 3, 'A dystopian social science fiction novel', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&h=600&fit=crop'),
('A Brief History of Time', 'Stephen Hawking', '978-0-553-38016-3', 'Science', 1988, 'Bantam Books', 2, 2, 'Exploring the universe from the Big Bang to black holes', 'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?w=400&h=600&fit=crop'),
('Sapiens', 'Yuval Noah Harari', '978-0-06-231609-7', 'History', 2011, 'Harper', 3, 3, 'A brief history of humankind', 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?w=400&h=600&fit=crop'),
('Clean Code', 'Robert C. Martin', '978-0-13-235088-4', 'Technology', 2008, 'Prentice Hall', 2, 1, 'A handbook of agile software craftsmanship', 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=400&h=600&fit=crop'),
('Harry Potter and the Sorcerer''s Stone', 'J.K. Rowling', '978-0-439-70818-8', 'Fantasy', 1997, 'Scholastic', 5, 5, 'The magical beginning of Harry Potter''s journey', 'https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf?w=400&h=600&fit=crop'),
('The Hobbit', 'J.R.R. Tolkien', '978-0-547-92822-7', 'Fantasy', 1937, 'Allen & Unwin', 3, 3, 'An unexpected journey to reclaim a lost kingdom', 'https://images.unsplash.com/photo-1614544048536-0d28caf77f41?w=400&h=600&fit=crop'),
('Steve Jobs', 'Walter Isaacson', '978-1-4516-4853-9', 'Biography', 2011, 'Simon & Schuster', 2, 1, 'The exclusive biography of Steve Jobs', 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400&h=600&fit=crop'),
('The Catcher in the Rye', 'J.D. Salinger', '978-0-316-76948-0', 'Fiction', 1951, 'Little, Brown', 2, 2, 'A story of teenage rebellion and alienation', 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=400&h=600&fit=crop'),
('Pride and Prejudice', 'Jane Austen', '978-0-14-143951-8', 'Fiction', 1813, 'T. Egerton', 3, 3, 'A romantic novel of manners', 'https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=400&h=600&fit=crop'),
('The Da Vinci Code', 'Dan Brown', '978-0-385-50420-1', 'Fiction', 2003, 'Doubleday', 2, 1, 'A mystery thriller novel', 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&h=600&fit=crop');

-- Insert Sample Borrowing Records
INSERT INTO borrowing_records (user_id, book_id, borrow_date, due_date, status, librarian_id) VALUES
(1, 3, NOW() - INTERVAL 5 DAY, DATE_ADD(CURDATE(), INTERVAL 9 DAY), 'borrowed', 3),
(1, 6, NOW() - INTERVAL 10 DAY, DATE_ADD(CURDATE(), INTERVAL 4 DAY), 'borrowed', 3),
(2, 9, NOW() - INTERVAL 15 DAY, CURDATE() - INTERVAL 1 DAY, 'overdue', 3),
(2, 12, NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 6 DAY, 'returned', 3);

-- Update available copies based on borrowing records
UPDATE books SET available_copies = available_copies - 1 WHERE book_id IN (3, 6, 9);

-- Create Views for Better Query Performance

-- View: Available Books
CREATE VIEW available_books AS
SELECT b.*, 
       (SELECT AVG(rating) FROM reviews WHERE book_id = b.book_id) as avg_rating,
       (SELECT COUNT(*) FROM reviews WHERE book_id = b.book_id) as review_count
FROM books b
WHERE b.available_copies > 0;

-- View: User Borrowing Summary
CREATE VIEW user_borrowing_summary AS
SELECT 
    u.user_id,
    u.username,
    u.full_name,
    COUNT(CASE WHEN br.status = 'borrowed' THEN 1 END) as currently_borrowed,
    COUNT(CASE WHEN br.status = 'returned' THEN 1 END) as total_returned,
    COUNT(CASE WHEN br.status = 'overdue' THEN 1 END) as overdue_count,
    SUM(br.fine_amount) as total_fines
FROM users u
LEFT JOIN borrowing_records br ON u.user_id = br.user_id
GROUP BY u.user_id, u.username, u.full_name;

-- View: Popular Books
CREATE VIEW popular_books AS
SELECT 
    b.*,
    COUNT(br.record_id) as borrow_count,
    AVG(r.rating) as avg_rating
FROM books b
LEFT JOIN borrowing_records br ON b.book_id = br.book_id
LEFT JOIN reviews r ON b.book_id = r.book_id
GROUP BY b.book_id
ORDER BY borrow_count DESC
LIMIT 20;