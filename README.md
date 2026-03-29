# Readify Library

A full-stack library management web application built with JavaScript. Readify provides a backend API to manage books, authors, and library operations, with supporting documentation included in the repository.

---

## Features

- RESTful API for managing library resources (books, authors, members, etc.)
- Modular backend architecture
- API documentation included in the `docs/` directory
- Easy local setup and development workflow

---

## Project Structure

```
Readify-Library/
├── backend/        # Node.js server, routes, models, and controllers
├── docs/           # API documentation and project references
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Language | JavaScript |
| API Style | REST |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- npm
- A running MongoDB instance (local or [MongoDB Atlas](https://www.mongodb.com/cloud/atlas))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/divyanshu0806/Readify-Library.git
   cd Readify-Library
   ```

2. **Navigate to the backend directory**
   ```bash
   cd backend
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Configure environment variables**

   Create a `.env` file inside the `backend/` directory:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   ```

5. **Start the server**
   ```bash
   npm start
   ```
   The API will be available at `http://localhost:5000`.

   For development with auto-reload:
   ```bash
   npm run dev
   ```

---

## API Overview

Refer to the [`docs/`](./docs) directory for full API documentation.

### Common Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/books` | Get all books |
| `POST` | `/api/books` | Add a new book |
| `GET` | `/api/books/:id` | Get book by ID |
| `PUT` | `/api/books/:id` | Update a book |
| `DELETE` | `/api/books/:id` | Delete a book |
| `GET` | `/api/authors` | Get all authors |
| `POST` | `/api/authors` | Add a new author |

> **Note:** Update these endpoints to match your actual routes.

---

## Available Scripts

Run these from inside the `backend/` directory:

| Script | Description |
|---|---|
| `npm start` | Start the production server |
| `npm run dev` | Start with hot-reload (nodemon) |
| `npm test` | Run test suite |

---

## Documentation

The `docs/` folder contains:
- API endpoint reference
- Data models / schema definitions
- Setup and configuration guides

---

## Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to your branch (`git push origin feature/your-feature`)
5. Open a Pull Request

---

## License

This project is open source and available under the [MIT License](LICENSE).
