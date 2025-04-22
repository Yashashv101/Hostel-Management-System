 USE hms_db;

-- Create rooms table to track room occupancy
CREATE TABLE IF NOT EXISTS rooms (
    room_id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    capacity INT DEFAULT 3,
    current_occupancy INT DEFAULT 0,
    status ENUM('available', 'full') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert 10 rooms initially
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

-- Create room_occupants table to track students in each room
CREATE TABLE IF NOT EXISTS room_occupants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    student_usn VARCHAR(20) NOT NULL,
    check_in_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id),
    FOREIGN KEY (student_usn) REFERENCES students(usn),
    UNIQUE KEY unique_student (student_usn)
);

-- Create trigger to update room status when occupants change
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