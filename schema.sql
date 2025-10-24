CREATE DATABASE IF NOT EXISTS hms_db;
USE hms_db;

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

CREATE TABLE IF NOT EXISTS complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usn VARCHAR(20) NOT NULL,
    complaint_text TEXT NOT NULL,
    status ENUM('pending', 'resolved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usn) REFERENCES students(usn)
);

CREATE TABLE IF NOT EXISTS workers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    assigned_date DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

INSERT INTO workers (name) VALUES 
('Worker 1'), ('Worker 2'), ('Worker 3'), ('Worker 4'), ('Worker 5'),
('Worker 6'), ('Worker 7'), ('Worker 8'), ('Worker 9'), ('Worker 10');

CREATE TABLE IF NOT EXISTS worker_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    worker_id INT NOT NULL,
    cleaning_request_id INT,
    room_number VARCHAR(20) NOT NULL,
    assignment_date DATE NOT NULL,
    time_slot TIME NOT NULL,
    status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES workers(id),
    FOREIGN KEY (cleaning_request_id) REFERENCES cleaning_requests(id) ON DELETE SET NULL
);

CREATE INDEX idx_worker_assignments_date ON worker_assignments(assignment_date);
CREATE INDEX idx_worker_assignments_worker ON worker_assignments(worker_id);

ALTER TABLE workers DROP COLUMN assigned_date;

ALTER TABLE cleaning_requests ADD COLUMN assignment_id INT NULL;
ALTER TABLE cleaning_requests ADD CONSTRAINT fk_cleaning_assignment FOREIGN KEY (assignment_id) REFERENCES worker_assignments(id) ON DELETE SET NULL;

ALTER TABLE workers ADD COLUMN phone_number VARCHAR(15) DEFAULT NULL;

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

CREATE TABLE IF NOT EXISTS rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    capacity INT DEFAULT 3,
    current_occupancy INT DEFAULT 0,
    status ENUM('available', 'full') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO rooms (room_number) VALUES
    ('101'),
    ('102'),
    ('103'),
    ('104'),
    ('105'),
    ('106'),
    ('107'),
    ('108'),
    ('109'),
    ('110');

CREATE TABLE IF NOT EXISTS room_occupants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    student_usn VARCHAR(20) NOT NULL,
    check_in_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id),
    FOREIGN KEY (student_usn) REFERENCES students(usn),
    UNIQUE KEY unique_student (student_usn)
);

DELIMITER //
CREATE TRIGGER after_occupant_insert
AFTER INSERT ON room_occupants
FOR EACH ROW
BEGIN
    UPDATE rooms r
    SET r.current_occupancy = (SELECT COUNT(*) FROM room_occupants WHERE room_id = NEW.room_id),
        r.status = CASE 
            WHEN (SELECT COUNT(*) FROM room_occupants WHERE room_id = NEW.room_id) >= 3 THEN 'full'
            ELSE 'available'
        END
    WHERE r.room_id = NEW.room_id;
END //

CREATE TRIGGER after_occupant_delete
AFTER DELETE ON room_occupants
FOR EACH ROW
BEGIN
    UPDATE rooms r
    SET r.current_occupancy = (SELECT COUNT(*) FROM room_occupants WHERE room_id = OLD.room_id),
        r.status = 'available'
    WHERE r.room_id = OLD.room_id;
END //
DELIMITER ;