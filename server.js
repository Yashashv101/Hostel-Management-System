const express = require('express');
const db = require('./db_config');
const app = express();

app.use(express.json());
app.use(express.static('.'));

// Student login
app.post('/api/student/login', async (req, res) => {
    try {
        const { usn, dob } = req.body;
        const [rows] = await db.execute(
            'SELECT * FROM students WHERE usn = ? AND dob = ?',
            [usn, dob]
        );
        if (rows.length > 0) {
            res.json({ success: true, student: rows[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    // In production, use proper authentication and hashed passwords
    if (username === 'Admin' && password === 'admin123') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// Add new student (Admin only)
app.post('/api/admin/add-student', async (req, res) => {
    try {
        const { usn, name, dob, branch, phone_number, parent_phone, room_id } = req.body;
        
        // Validate input
        if (!usn || !name || !dob || !branch || !phone_number || !parent_phone || !room_id) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Check if student already exists
        const [existing] = await db.execute('SELECT usn FROM students WHERE usn = ?', [usn]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Student with this USN already exists' });
        }

        // Check room capacity
        const [roomCheck] = await db.execute(
            'SELECT current_occupancy, capacity FROM rooms WHERE room_id = ?',
            [room_id]
        );

        if (roomCheck.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid room selected' });
        }

        if (roomCheck[0].current_occupancy >= roomCheck[0].capacity) {
            return res.status(400).json({ success: false, message: 'Selected room is full' });
        }

        // Get a connection from the pool for transaction
        const connection = await db.getConnection();
        
        try {
            // Start transaction
            await connection.beginTransaction();
            
            // Insert student
            await connection.execute(
                'INSERT INTO students (usn, name, dob, branch, phone_number, parent_phone, room_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [usn, name, dob, branch, phone_number, parent_phone, room_id]
            );

            // Add room occupant
            await connection.execute(
                'INSERT INTO room_occupants (room_id, student_usn) VALUES (?, ?)',
                [room_id, usn]
            );

            // Update room occupancy
            await connection.execute(
                'UPDATE rooms SET current_occupancy = (SELECT COUNT(*) FROM room_occupants WHERE room_id = ?), status = CASE WHEN (SELECT COUNT(*) FROM room_occupants WHERE room_id = ?) >= 3 THEN "full" ELSE "available" END WHERE room_id = ?',
                [room_id, room_id, room_id]
            );

            await connection.commit();
            res.json({ success: true, message: 'Student added successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            // Release the connection back to the pool
            connection.release();
        }
    } catch (error) {
        console.error('Error adding student:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: 'Student with this USN already exists' });
        } else {
            res.status(500).json({ success: false, message: 'Database error. Please try again later.' });
        }
    }
});

// Search student by USN
app.post('/api/admin/search-student', async (req, res) => {
    try {
        const { usn } = req.body;
        const [rows] = await db.execute(
            'SELECT s.*, r.room_number FROM students s LEFT JOIN rooms r ON s.room_id = r.room_id WHERE s.usn = ?',
            [usn]
        );
        if (rows.length > 0) {
            res.json({ success: true, student: rows[0] });
        } else {
            res.json({ success: false, message: 'Student not found' });
        }
    } catch (error) {
        console.error('Error searching student:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update request status
app.put('/api/admin/update-status', async (req, res) => {
    try {
        const { type, id, status, room_number } = req.body;
        
        // Validate required parameters
        if (!type || !id || !status) {
            return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }
        
        let table;
        switch(type) {
            case 'roomRequests': table = 'room_applications'; break;
            case 'complaints': table = 'complaints'; break;
            case 'cleaningRequests': table = 'cleaning_requests'; break;
            default: throw new Error('Invalid request type');
        }
        
        if (type === 'cleaningRequests' && status === 'completed') {
            // Get the cleaning request details to update worker availability
            const [cleaningRequest] = await db.execute(
                'SELECT worker_id, preferred_time FROM cleaning_requests WHERE id = ?',
                [id]
            );
            
            if (cleaningRequest.length > 0 && cleaningRequest[0].worker_id) {
                // Update worker's assigned_date and availability
                await db.execute(
                    'UPDATE workers SET assigned_date = ?, is_available = FALSE WHERE id = ?',
                    [cleaningRequest[0].preferred_time, cleaningRequest[0].worker_id]
                );
            }
            
            // Update the cleaning request status
            await db.execute(
                `UPDATE ${table} SET status = ? WHERE id = ?`,
                [status, id]
            );
        } else if (type === 'roomRequests' && status === 'approved') {
            if (!room_number) {
                return res.status(400).json({ success: false, message: 'Room number is required for approval' });
            }
            
            // Get the room application details
            const [application] = await db.execute(
                'SELECT usn, room_type FROM room_applications WHERE id = ?',
                [id]
            );
            
            if (application.length === 0) {
                return res.status(404).json({ success: false, message: 'Room application not found' });
            }
            
            const { usn, room_type } = application[0];
            
            // Check if student already exists in the students table
            const [existingStudent] = await db.execute('SELECT usn FROM students WHERE usn = ?', [usn]);
            
            // If student doesn't exist, add them to the students table
            if (existingStudent.length === 0) {
                // Get student details from the application form
                const [studentDetails] = await db.execute(
                    'SELECT student_name, dob FROM room_applications WHERE id = ?',
                    [id]
                );
                
                if (studentDetails.length > 0 && studentDetails[0].student_name && studentDetails[0].dob) {
                    // Add student to students table
                    await db.execute(
                        'INSERT INTO students (usn, name, dob) VALUES (?, ?, ?)',
                        [usn, studentDetails[0].student_name, studentDetails[0].dob]
                    );
                }
            }
            
            // Update the room application status
            await db.execute(
                `UPDATE ${table} SET status = ?, room_number = ? WHERE id = ?`,
                [status, room_number, id]
            );
        } else {
            await db.execute(
                `UPDATE ${table} SET status = ? WHERE id = ?`,
                [status, id]
            );
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all rooms with occupants
app.get('/api/admin/rooms', async (req, res) => {
    try {
        const [rooms] = await db.execute(
            `SELECT r.*, 
            GROUP_CONCAT(
                JSON_OBJECT(
                    'usn', ro.student_usn, 
                    'name', s.name
                )
            ) as occupants
            FROM rooms r
            LEFT JOIN room_occupants ro ON r.room_id = ro.room_id
            LEFT JOIN students s ON ro.student_usn = s.usn
            GROUP BY r.room_id`
        );

        // Parse the occupants JSON string for each room
        const formattedRooms = rooms.map(room => ({
            ...room,
            occupants: room.occupants ? JSON.parse(`[${room.occupants}]`) : []
        }));

        res.json(formattedRooms);
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Submit complaint
app.post('/api/complaint', async (req, res) => {
    try {
        const { usn, complaint_text } = req.body;

        // Validate input
        if (!usn || !complaint_text) {
            return res.status(400).json({ success: false, message: 'USN and complaint text are required' });
        }

        // Check if student exists
        const [student] = await db.execute('SELECT usn FROM students WHERE usn = ?', [usn]);
        if (student.length === 0) {
            return res.status(400).json({ success: false, message: 'Student not found. Please register first.' });
        }

        await db.execute(
            'INSERT INTO complaints (usn, complaint_text, status, created_at) VALUES (?, ?, "pending", CURRENT_TIMESTAMP)',
            [usn, complaint_text]
        );
        res.json({ success: true, message: 'Complaint submitted successfully' });
    } catch (error) {
        console.error('Error submitting complaint:', error);
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ success: false, message: 'Student not found. Please register first.' });
        } else {
            res.status(500).json({ success: false, message: 'Database error. Please try again later.' });
        }
    }
});

// Get complaints
app.get('/api/admin/complaints', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT c.*, s.name as student_name FROM complaints c JOIN students s ON c.usn = s.usn WHERE c.status = "pending"'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get cleaning requests
app.get('/api/admin/cleaning-requests', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT cr.*, s.name as student_name FROM cleaning_requests cr JOIN students s ON cr.usn = s.usn WHERE cr.status = "pending"'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get available workers for a specific date
app.get('/api/available-workers', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is required' });
        }

        // Check for available workers based on is_available flag
        const [availableWorkers] = await db.execute(
            'SELECT id, name FROM workers WHERE is_available = TRUE AND (assigned_date IS NULL OR assigned_date != ?)',
            [date]
        );

        res.json({ success: true, available: availableWorkers.length > 0, workers: availableWorkers });
    } catch (error) {
        console.error('Error checking worker availability:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Submit cleaning request
app.post('/api/cleaning-request', async (req, res) => {
    try {
        const { usn, roomNumber, date } = req.body;

        if (!usn || !roomNumber || !date) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const [student] = await db.execute('SELECT usn FROM students WHERE usn = ?', [usn]);
        if (student.length === 0) {
            return res.status(400).json({ success: false, message: 'Student not found' });
        }

        // Check if any worker is available on the requested date
        const [availableWorkers] = await db.execute(
            'SELECT id FROM workers WHERE is_available = TRUE AND (assigned_date IS NULL OR assigned_date != ?) LIMIT 1',
            [date]
        );

        // Check if workers are available
        let workerId = null;
        if (availableWorkers.length === 0) {
            return res.status(400).json({ success: false, message: 'No workers available on the requested date. Please select a different date.' });
        } else {
            workerId = availableWorkers[0].id;
        }

        try {
            // Try with worker_id first (as per schema)
            await db.execute(
                'INSERT INTO cleaning_requests (usn, room_number, preferred_time, worker_id, status) VALUES (?, ?, ?, ?, "pending")',
                [usn, roomNumber, date, workerId]
            );
        } catch (err) {
            // If worker_id column doesn't exist, insert without it
            if (err.code === 'ER_BAD_FIELD_ERROR' && err.sqlMessage.includes("worker_id")) {
                await db.execute(
                    'INSERT INTO cleaning_requests (usn, room_number, preferred_time, status) VALUES (?, ?, ?, "pending")',
                    [usn, roomNumber, date]
                );
            } else {
                // If it's a different error, rethrow it
                throw err;
            }
        }
        
        res.json({ success: true, message: 'Cleaning request submitted' });
    } catch (error) {
        console.error('Error submitting cleaning request:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});