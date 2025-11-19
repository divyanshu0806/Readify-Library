// Updated home_script.js with Backend API Integration

// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Authentication token storage
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('currentUser'));
let userType = 'student';

// API Helper Functions with timeout
const apiCall = async (endpoint, options = {}) => {
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    if (authToken) {
        config.headers['Authorization'] = `Bearer ${authToken}`;
    }

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    config.signal = controller.signal;

    try {
        console.log(`🌐 API Call: ${endpoint}`);
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        clearTimeout(timeoutId);
        
        const data = await response.json();
        console.log(`✅ API Response (${endpoint}):`, data);

        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.error('❌ API Timeout:', endpoint);
            throw new Error('Request timeout - backend might be slow or not responding');
        }
        console.error('❌ API Error:', error);
        throw error;
    }
};

// Navigation
function showSection(sectionName) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    if (sectionName === 'books') {
        loadBooks();
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Search from home
function searchFromHome() {
    const searchTerm = document.getElementById('homeSearch').value;
    showSection('books');
    const searchTitle = document.getElementById('searchTitle');
    if (searchTitle) {
        searchTitle.value = searchTerm;
        filterBooks();
    }
}

// Load books from backend
async function loadBooks() {
    try {
        const books = await apiCall('/books');
        displayBooks(books);
    } catch (error) {
        console.error('Failed to load books:', error);
        const grid = document.getElementById('booksGrid');
        if (grid) {
            grid.innerHTML = '<p style="text-align: center; grid-column: 1/-1; color: #f56565;">Failed to load books. Make sure backend is running.</p>';
        }
    }
}

// Display books
function displayBooks(books) {
    const grid = document.getElementById('booksGrid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!books || books.length === 0) {
        grid.innerHTML = '<p style="text-align: center; grid-column: 1/-1; font-size: 1.2rem; color: #666;">No books found matching your criteria.</p>';
        return;
    }

    books.forEach(book => {
        const isAvailable = book.available_copies > 0;
        
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <div class="book-cover">
                <img src="${book.image_url || 'https://via.placeholder.com/400x600?text=No+Image'}" 
                     alt="${book.title}" 
                     onerror="this.style.display='none'; this.parentElement.innerHTML='📚';">
            </div>
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-author">by ${book.author}</div>
                <span class="book-genre">${book.genre}</span>
                <div class="book-meta" style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;">
                    ${book.publication_year ? `Year: ${book.publication_year}` : ''}
                    ${book.isbn ? ` | ISBN: ${book.isbn}` : ''}
                </div>
                <div class="book-status">
                    <span class="status-badge ${isAvailable ? 'available' : 'borrowed'}">
                        ${isAvailable ? `✓ Available (${book.available_copies})` : '✗ Not Available'}
                    </span>
                    <button class="borrow-btn" 
                            ${!currentUser || !isAvailable ? 'disabled' : ''} 
                            onclick="borrowBook(${book.book_id})">
                        Borrow
                    </button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Filter books
async function filterBooks() {
    try {
        const titleSearch = document.getElementById('searchTitle')?.value || '';
        const authorSearch = document.getElementById('searchAuthor')?.value || '';
        const genreFilter = document.getElementById('searchGenre')?.value || '';
        const statusFilter = document.getElementById('searchStatus')?.value || '';

        let url = '/books?';
        const params = [];

        if (titleSearch) params.push(`title=${encodeURIComponent(titleSearch)}`);
        if (authorSearch) params.push(`author=${encodeURIComponent(authorSearch)}`);
        if (genreFilter) params.push(`genre=${encodeURIComponent(genreFilter)}`);
        if (statusFilter) params.push(`status=${statusFilter}`);

        url += params.join('&');

        const books = await apiCall(url);
        displayBooks(books);
    } catch (error) {
        alert('Failed to filter books: ' + error.message);
    }
}

// Borrow book
async function borrowBook(bookId) {
    if (!currentUser) {
        alert('Please login to borrow books!');
        showSection('login');
        return;
    }

    if (!confirm('Do you want to borrow this book?')) {
        return;
    }

    try {
        const result = await apiCall('/borrow', {
            method: 'POST',
            body: JSON.stringify({ bookId })
        });

        alert(`✅ ${result.message}\n📅 Due Date: ${result.dueDate}`);
        
        loadBooks();
        
        if (currentUser) {
            await loadUserStats();
        }
    } catch (error) {
        alert('❌ Failed to borrow book: ' + error.message);
    }
}

// Return book
async function returnBook(bookId) {
    if (!confirm('Are you sure you want to return this book?')) {
        return;
    }

    try {
        const result = await apiCall('/return', {
            method: 'POST',
            body: JSON.stringify({ bookId })
        });

        let message = result.message;
        if (result.fine > 0) {
            message += `\n\n💰 Fine: ₹${result.fine}\n⏰ Days Overdue: ${result.daysOverdue}`;
        }

        alert(message);
        
        await loadUserStats();
        
        const booksSection = document.getElementById('books');
        if (booksSection && booksSection.classList.contains('active')) {
            loadBooks();
        }
    } catch (error) {
        alert('❌ Failed to return book: ' + error.message);
    }
}

// Login tabs
function switchTab(type) {
    userType = type;
    const tabs = document.querySelectorAll('.login-tab');
    tabs.forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Show registration form
function showRegistrationForm() {
    const loginForm = document.getElementById('loginFormSection');
    const regForm = document.getElementById('registrationFormSection');
    
    if (loginForm && regForm) {
        loginForm.style.display = 'none';
        regForm.style.display = 'block';
    }
}

// Show login form
function showLoginForm() {
    const loginForm = document.getElementById('loginFormSection');
    const regForm = document.getElementById('registrationFormSection');
    
    if (loginForm && regForm) {
        loginForm.style.display = 'block';
        regForm.style.display = 'none';
    }
}

// Handle registration
async function handleRegister(event) {
    event.preventDefault();
    
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;

    if (password !== confirmPassword) {
        alert('Passwords do not match!');
        return;
    }

    if (password.length < 6) {
        alert('Password must be at least 6 characters long!');
        return;
    }

    const formData = {
        username: document.getElementById('regUsername')?.value,
        email: document.getElementById('regEmail')?.value,
        password: password,
        fullName: document.getElementById('regFullName')?.value,
        userType: userType,
        phone: document.getElementById('regPhone')?.value || '',
        address: document.getElementById('regAddress')?.value || ''
    };

    try {
        const result = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify(formData)
        });

        alert('✅ Registration successful! You can now login with your credentials.');
        showLoginForm();
        
        event.target.reset();
        
        const loginUsername = document.getElementById('loginUsername');
        if (loginUsername) {
            loginUsername.value = formData.username;
        }
    } catch (error) {
        alert('❌ Registration failed: ' + error.message);
    }
}

// Handle login
async function handleLogin(event) {
    event.preventDefault();
    
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    
    if (!usernameInput || !passwordInput) {
        alert('❌ Login form elements not found! Please refresh the page.');
        return;
    }

    const username = usernameInput.value;
    const password = passwordInput.value;

    if (!username || !password) {
        alert('Please enter both username and password!');
        return;
    }

    try {
        const result = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        authToken = result.token;
        currentUser = result.user;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        const loginFormSection = document.getElementById('loginFormSection');
        const regFormSection = document.getElementById('registrationFormSection');
        const userDashboard = document.getElementById('userDashboard');
        const userName = document.getElementById('userName');

        if (loginFormSection) loginFormSection.style.display = 'none';
        if (regFormSection) regFormSection.style.display = 'none';
        if (userDashboard) {
            userDashboard.style.display = 'block';
            userDashboard.classList.remove('hidden');
        }
        if (userName) userName.textContent = currentUser.fullName || currentUser.username;
        
        await loadUserStats();
        
        alert(`✅ Welcome ${currentUser.fullName || currentUser.username}!`);
        
    } catch (error) {
        alert('❌ Login failed: ' + error.message);
        console.error('Login error:', error);
    }
}

// Handle logout
function handleLogout() {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    const loginForm = document.getElementById('loginFormSection');
    const regForm = document.getElementById('registrationFormSection');
    const userDashboard = document.getElementById('userDashboard');
    const loginUsername = document.getElementById('loginUsername');
    const loginPassword = document.getElementById('loginPassword');

    if (loginForm) loginForm.style.display = 'block';
    if (regForm) regForm.style.display = 'none';
    if (userDashboard) userDashboard.classList.add('hidden');
    if (loginUsername) loginUsername.value = '';
    if (loginPassword) loginPassword.value = '';
    
    const booksGrid = document.getElementById('booksGrid');
    if (booksGrid && booksGrid.innerHTML) {
        loadBooks();
    }
    
    alert('Successfully logged out!');
}

// Load user statistics
async function loadUserStats() {
    if (!currentUser) return;

    try {
        const stats = await apiCall('/users/stats');
        const borrowedCount = document.getElementById('borrowedCount');
        const historyCount = document.getElementById('historyCount');
        
        if (borrowedCount) borrowedCount.textContent = stats.currently_borrowed;
        if (historyCount) {
            historyCount.textContent = stats.currently_borrowed + stats.total_returned;
        }

        await loadCurrentBooks();
        await loadBorrowingHistory();
        
    } catch (error) {
        console.error('Failed to load user stats:', error);
    }
}

// Load current borrowed books
async function loadCurrentBooks() {
    if (!currentUser) return;

    const container = document.getElementById('currentBooksContainer');
    if (!container) return;

    container.innerHTML = '<p style="text-align: center; color: #666;">⏳ Loading borrowed books...</p>';

    try {
        console.log('📚 Loading current borrowed books for user:', currentUser.userId);
        
        const books = await apiCall('/borrowing/current');
        
        console.log('✅ Current books received:', books);
        
        displayCurrentBooks(books);
    } catch (error) {
        console.error('❌ Failed to load current books:', error);
        if (container) {
            container.innerHTML = `
                <div class="empty-state" style="color: #f56565;">
                    <p>⚠️ Failed to load borrowed books</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">Error: ${error.message}</p>
                    <button onclick="loadCurrentBooks()" style="background: #667eea; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-top: 1rem;">
                        🔄 Try Again
                    </button>
                </div>
            `;
        }
    }
}

// Display current borrowed books
function displayCurrentBooks(books) {
    const container = document.getElementById('currentBooksContainer');
    if (!container) return;

    if (!books || books.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📚</div>
                <p>You haven't borrowed any books yet</p>
                <button class="btn btn-primary" onclick="showSection('books')" style="margin-top: 1rem; padding: 0.5rem 1.5rem;">Browse Books</button>
            </div>
        `;
        return;
    }

    let html = '';
    books.forEach(book => {
        const borrowDate = new Date(book.borrow_date).toLocaleDateString();
        const dueDate = new Date(book.due_date).toLocaleDateString();
        const isOverdue = new Date(book.due_date) < new Date();
        
        html += `
            <div class="book-item">
                <div class="book-item-title">${book.title}</div>
                <div class="book-item-author">by ${book.author}</div>
                <span class="book-genre" style="display: inline-block; background: #e2e8f0; padding: 0.2rem 0.6rem; border-radius: 15px; font-size: 0.85rem; color: #667eea;">${book.genre}</span>
                <div class="book-item-dates">
                    <div class="date-info">
                        <span>📅 Borrowed:</span>
                        <strong>${borrowDate}</strong>
                    </div>
                    <div class="date-info ${isOverdue ? 'due' : ''}">
                        <span>⏰ Due:</span>
                        <strong>${dueDate}</strong>
                        ${isOverdue ? ' (OVERDUE!)' : ''}
                    </div>
                </div>
                <span class="status-badge-item ${isOverdue ? 'status-overdue' : 'status-borrowed'}">
                    ${isOverdue ? '⚠️ Overdue' : '📖 Borrowed'}
                </span>
                <button class="return-btn" onclick="returnBook(${book.book_id})">Return Book</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Load borrowing history
async function loadBorrowingHistory() {
    if (!currentUser) return;

    const container = document.getElementById('historyContainer');
    if (!container) return;

    container.innerHTML = '<p style="text-align: center; color: #666;">⏳ Loading history...</p>';

    try {
        console.log('📖 Loading borrowing history for user:', currentUser.userId);
        const history = await apiCall('/borrowing/history');
        console.log('✅ History received:', history);
        displayBorrowingHistory(history);
    } catch (error) {
        console.error('❌ Failed to load borrowing history:', error);
        if (container) {
            container.innerHTML = `
                <div class="empty-state" style="color: #f56565;">
                    <p>⚠️ Failed to load history</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">Error: ${error.message}</p>
                    <button onclick="loadBorrowingHistory()" style="background: #667eea; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; margin-top: 1rem;">
                        🔄 Try Again
                    </button>
                </div>
            `;
        }
    }
}

// Display borrowing history
function displayBorrowingHistory(history) {
    const container = document.getElementById('historyContainer');
    if (!container) return;

    if (!history || history.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📖</div>
                <p>No borrowing history yet</p>
            </div>
        `;
        return;
    }

    const recentHistory = history.slice(0, 5);
    
    let html = '';
    recentHistory.forEach(record => {
        const borrowDate = new Date(record.borrow_date).toLocaleDateString();
        const dueDate = new Date(record.due_date).toLocaleDateString();
        const returnDate = record.return_date ? new Date(record.return_date).toLocaleDateString() : null;
        const status = record.status;
        
        let statusClass = 'status-borrowed';
        let statusText = '📖 Borrowed';
        
        if (status === 'returned') {
            statusClass = 'status-returned';
            statusText = '✅ Returned';
        } else if (status === 'overdue') {
            statusClass = 'status-overdue';
            statusText = '⚠️ Overdue';
        }
        
        html += `
            <div class="book-item">
                <div class="book-item-title">${record.title}</div>
                <div class="book-item-author">by ${record.author}</div>
                <span class="book-genre" style="display: inline-block; background: #e2e8f0; padding: 0.2rem 0.6rem; border-radius: 15px; font-size: 0.85rem; color: #667eea;">${record.genre}</span>
                <div class="book-item-dates">
                    <div class="date-info">
                        <span>📅 Borrowed:</span>
                        <strong>${borrowDate}</strong>
                    </div>
                    <div class="date-info">
                        <span>⏰ Due:</span>
                        <strong>${dueDate}</strong>
                    </div>
                    ${returnDate ? `
                    <div class="date-info returned">
                        <span>✅ Returned:</span>
                        <strong>${returnDate}</strong>
                    </div>
                    ` : ''}
                    ${record.fine_amount > 0 ? `
                    <div class="date-info due">
                        <span>💰 Fine:</span>
                        <strong>₹${record.fine_amount}</strong>
                    </div>
                    ` : ''}
                </div>
                <span class="status-badge-item ${statusClass}">
                    ${statusText}
                </span>
            </div>
        `;
    });

    if (history.length > 5) {
        html += `<p style="text-align: center; color: #666; margin-top: 1rem;">Showing 5 of ${history.length} records</p>`;
    }

    container.innerHTML = html;
}

// Handle contact form
function handleContactSubmit(event) {
    event.preventDefault();
    alert('Thank you for your message! We will get back to you soon.');
    event.target.reset();
}

// Check authentication on page load
function checkAuth() {
    if (authToken && currentUser) {
        const loginForm = document.getElementById('loginFormSection');
        const regForm = document.getElementById('registrationFormSection');
        const userDashboard = document.getElementById('userDashboard');
        const userName = document.getElementById('userName');

        if (loginForm) loginForm.style.display = 'none';
        if (regForm) regForm.style.display = 'none';
        if (userDashboard) {
            userDashboard.style.display = 'block';
            userDashboard.classList.remove('hidden');
        }
        if (userName) userName.textContent = currentUser.fullName || currentUser.username;
        
        loadUserStats();
    }
}

// Initialize on page load
window.onload = function() {
    console.log('🚀 Readify Library System initialized');
    console.log('📡 API URL:', API_BASE_URL);
    
    checkAuth();
    
    const booksSection = document.getElementById('books');
    if (booksSection && booksSection.classList.contains('active')) {
        loadBooks();
    }
};