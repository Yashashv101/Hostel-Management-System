-- Create worker_assignments table to track cleaning assignments with better granularity
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

-- Add index for faster queries
CREATE INDEX idx_worker_assignments_date ON worker_assignments(assignment_date);
CREATE INDEX idx_worker_assignments_worker ON worker_assignments(worker_id);

-- Modify workers table to remove the assigned_date field (will be tracked in worker_assignments)
ALTER TABLE workers DROP COLUMN assigned_date;

-- Update the cleaning_requests table to add a reference to worker_assignments
ALTER TABLE cleaning_requests ADD COLUMN assignment_id INT NULL;
ALTER TABLE cleaning_requests ADD CONSTRAINT fk_cleaning_assignment FOREIGN KEY (assignment_id) REFERENCES worker_assignments(id) ON DELETE SET NULL;