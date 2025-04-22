-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS hms_db;
USE hms_db;

-- Create students table
CREATE TABLE IF NOT EXISTS students (
    usn VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    dob DATE NOT NULL,
    branch VARCHAR(50) NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    parent_phone VARCHAR(15) NOT NULL,
    room_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);

-- Create complaints table
CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usn VARCHAR(20) NOT NULL,
    complaint_text TEXT NOT NULL,
    status ENUM('pending', 'resolved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usn) REFERENCES students(usn)
);

-- Create workers table for cleaning staff
CREATE TABLE IF NOT EXISTS workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    assigned_date DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create worker_availability table to track available dates
CREATE TABLE IF NOT EXISTS worker_availability (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    available_date DATE NOT NULL,
    FOREIGN KEY (worker_id) REFERENCES workers(id),
    UNIQUE KEY (worker_id, available_date)
);

-- Create cleaning_requests table
CREATE TABLE IF NOT EXISTS cleaning_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usn VARCHAR(20) NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    preferred_time DATETIME NOT NULL,
    worker_id INT,
    status ENUM('pending', 'completed', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usn) REFERENCES students(usn),
    FOREIGN KEY (worker_id) REFERENCES workers(id)
);

-- Insert default workers (10 workers)
INSERT INTO workers (name) VALUES 
('Worker 1'), ('Worker 2'), ('Worker 3'), ('Worker 4'), ('Worker 5'),
('Worker 6'), ('Worker 7'), ('Worker 8'), ('Worker 9'), ('Worker 10');