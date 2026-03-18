---
name: database
description: Assist with SQL queries, database schema design, migrations, query optimization, and database operations. Use when working with SQL, NoSQL, schema changes, query performance, or database-related tasks.
---

# Database Operations

## Quick Start

### Common Tasks
```
1. Write/optimize SQL queries
2. Design database schemas
3. Create migration scripts
4. Analyze query performance
5. Debug connection issues
```

### Connection Strings
```
# PostgreSQL
postgresql://user:password@localhost:5432/dbname

# MySQL
mysql://user:password@localhost:3306/dbname

# MongoDB
mongodb://user:password@localhost:27017/dbname

# SQLite
sqlite:///path/to/database.db
```

## SQL Query Best Practices

### SELECT Statements
```sql
-- Good - specific columns
SELECT id, name, email
FROM users
WHERE status = 'active'
ORDER BY created_at DESC
LIMIT 10;

-- Bad - SELECT *
SELECT * FROM users;
```

### JOIN Operations
```sql
-- INNER JOIN - matching rows only
SELECT u.name, o.order_date, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.status = 'completed';

-- LEFT JOIN - all from left, matching from right
SELECT u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name;

-- Multiple JOINs
SELECT u.name, o.order_date, p.product_name
FROM users u
INNER JOIN orders o ON u.id = o.user_id
INNER JOIN order_items oi ON o.id = oi.order_id
INNER JOIN products p ON oi.product_id = p.id;
```

### Subqueries vs CTEs
```sql
-- CTE (Common Table Expression) - more readable
WITH active_users AS (
    SELECT id, name
    FROM users
    WHERE last_login > DATE_SUB(NOW(), INTERVAL 30 DAY)
)
SELECT au.name, COUNT(o.id) as orders
FROM active_users au
LEFT JOIN orders o ON au.id = o.user_id
GROUP BY au.id, au.name;

-- Subquery - useful for simple cases
SELECT name,
       (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count
FROM users;
```

## Query Optimization

### Use EXPLAIN to Analyze
```sql
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
```

### Index Guidelines
```sql
-- Create index for frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- Composite index for multi-column queries
CREATE INDEX idx_orders_user_status ON orders(user_id, status);

-- Partial index for specific conditions
CREATE INDEX idx_active_users ON users(email) WHERE status = 'active';
```

### Optimization Tips

1. **Avoid functions on indexed columns**
```sql
-- Bad - index not used
WHERE YEAR(created_at) = 2024

-- Good - index used
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
```

2. **Use LIMIT for large datasets**
```sql
SELECT * FROM logs
WHERE created_at > '2024-01-01'
ORDER BY created_at DESC
LIMIT 100;
```

3. **Avoid SELECT ***
```sql
-- Bad
SELECT * FROM users

-- Good
SELECT id, name, email FROM users
```

4. **Use EXISTS instead of IN for large subqueries**
```sql
-- Good
SELECT * FROM users u
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.user_id = u.id
);

-- Slower for large datasets
SELECT * FROM users
WHERE id IN (SELECT user_id FROM orders);
```

## Schema Design

### Normalization Guidelines

**First Normal Form (1NF)**
- No repeating groups
- Each column contains atomic values

**Second Normal Form (2NF)**
- Meets 1NF
- All non-key columns depend on the entire primary key

**Third Normal Form (3NF)**
- Meets 2NF
- No transitive dependencies

### Table Design Example
```sql
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status)
);

CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status ENUM('pending', 'paid', 'shipped', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);
```

## Migrations

### Migration Script Template
```sql
-- Migration: 001_create_users_table
-- Created at: 2024-01-15 10:00:00

-- UP
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DOWN
DROP TABLE IF EXISTS users;
```

### Adding Columns
```sql
-- UP
ALTER TABLE users
ADD COLUMN phone VARCHAR(20),
ADD COLUMN country VARCHAR(50);

-- DOWN
ALTER TABLE users
DROP COLUMN phone,
DROP COLUMN country;
```

### Creating Indexes
```sql
-- UP
CREATE INDEX idx_users_created_at ON users(created_at);

-- DOWN
DROP INDEX idx_users_created_at ON users;
```

## Common Operations

### Insert
```sql
-- Single row
INSERT INTO users (email, name)
VALUES ('user@example.com', 'John Doe');

-- Multiple rows
INSERT INTO users (email, name) VALUES
    ('user1@example.com', 'User One'),
    ('user2@example.com', 'User Two'),
    ('user3@example.com', 'User Three');

-- Insert from select
INSERT INTO user_backup (email, name)
SELECT email, name FROM users WHERE status = 'inactive';
```

### Update
```sql
-- Simple update
UPDATE users
SET status = 'active'
WHERE id = 123;

-- Update with join
UPDATE orders o
JOIN users u ON o.user_id = u.id
SET o.discount = 0.1
WHERE u.status = 'premium';
```

### Delete
```sql
-- Delete with condition
DELETE FROM users
WHERE status = 'inactive'
AND last_login < DATE_SUB(NOW(), INTERVAL 1 YEAR);

-- Soft delete (preferred)
UPDATE users
SET deleted_at = NOW()
WHERE id = 123;
```

### Upsert (Insert or Update)
```sql
-- MySQL
INSERT INTO users (email, name)
VALUES ('user@example.com', 'John Doe')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- PostgreSQL
INSERT INTO users (email, name)
VALUES ('user@example.com', 'John Doe')
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;
```

## Aggregation

### GROUP BY
```sql
-- Count orders per user
SELECT user_id, COUNT(*) as order_count, SUM(total) as total_spent
FROM orders
GROUP BY user_id
HAVING total_spent > 1000
ORDER BY total_spent DESC;
```

### Window Functions
```sql
-- Rank users by spending
SELECT
    user_id,
    total_spent,
    RANK() OVER (ORDER BY total_spent DESC) as spending_rank
FROM (
    SELECT user_id, SUM(total) as total_spent
    FROM orders
    GROUP BY user_id
) t;

-- Running total
SELECT
    order_date,
    total,
    SUM(total) OVER (ORDER BY order_date) as running_total
FROM orders;
```

## Transaction Management

```sql
-- Start transaction
START TRANSACTION;

-- Perform operations
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;

-- Commit if successful
COMMIT;

-- Rollback on error
ROLLBACK;
```

### Python Example
```python
import psycopg2
from contextlib import contextmanager

@contextmanager
def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

# Usage
with get_db_connection() as conn:
    cursor = conn.cursor()
    cursor.execute("INSERT INTO users (email) VALUES (%s)", (email,))
```

## NoSQL (MongoDB)

### Basic Operations
```javascript
// Insert
db.users.insertOne({
    email: "user@example.com",
    name: "John Doe",
    createdAt: new Date()
});

// Find
db.users.find({ status: "active" }).limit(10);

// Update
db.users.updateOne(
    { _id: ObjectId("...") },
    { $set: { status: "inactive" } }
);

// Delete
db.users.deleteOne({ _id: ObjectId("...") });
```

### Aggregation Pipeline
```javascript
db.orders.aggregate([
    { $match: { status: "completed" } },
    { $group: {
        _id: "$userId",
        totalSpent: { $sum: "$total" },
        orderCount: { $sum: 1 }
    }},
    { $sort: { totalSpent: -1 } },
    { $limit: 10 }
]);
```

## Backup & Restore

### PostgreSQL
```bash
# Backup
pg_dump -U username -h localhost dbname > backup.sql

# Restore
psql -U username -h localhost dbname < backup.sql
```

### MySQL
```bash
# Backup
mysqldump -u username -p dbname > backup.sql

# Restore
mysql -u username -p dbname < backup.sql
```

### MongoDB
```bash
# Backup
mongodump --uri="mongodb://localhost:27017/dbname" --out=./backup

# Restore
mongorestore --uri="mongodb://localhost:27017/dbname" ./backup/dbname
```

## Performance Troubleshooting

### Find Slow Queries
```sql
-- MySQL - enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2;

-- PostgreSQL - query pg_stat_statements
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;
```

### Check Table Sizes
```sql
-- PostgreSQL
SELECT
    relname AS table_name,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- MySQL
SELECT
    table_name,
    ROUND(data_length / 1024 / 1024, 2) AS size_mb
FROM information_schema.tables
WHERE table_schema = 'your_database'
ORDER BY data_length DESC;
```
