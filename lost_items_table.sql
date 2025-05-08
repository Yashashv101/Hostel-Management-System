-- Create lost_items table
CREATE TABLE IF NOT EXISTS lost_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usn VARCHAR(20) NOT NULL,
    item_name VARCHAR(100) NOT NULL,
    description TEXT,
    location VARCHAR(100),
    status ENUM('pending', 'found', 'closed') DEFAULT 'pending',
    finder_usn VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usn) REFERENCES students(usn),
    FOREIGN KEY (finder_usn) REFERENCES students(usn)
);