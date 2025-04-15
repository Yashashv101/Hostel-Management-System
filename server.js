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
        const { usn, name, dob } = req.body;
        
        // Validate input
        if (!usn || !name || !dob) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Check if student already exists
        const [existing] = await db.execute('SELECT usn FROM students WHERE usn = ?', [usn]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Student with this USN already exists' });
        }

        await db.execute(
            'INSERT INTO students (usn, name, dob) VALUES (?, ?, ?)',
            [usn, name, dob]
        );
        res.json({ success: true, message: 'Student added successfully' });
    } catch (error) {
        console.error('Error adding student:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ success: false, message: 'Student with this USN already exists' });
        } else {
            res.status(500).json({ success: false, message: 'Database error. Please try again later.' });
        }
    }
});

// Submit room application
app.post('/api/room-application', async (req, res) => {
    try {
        const { usn, room_type } = req.body;

        // Validate input
        if (!usn || !room_type) {
            return res.status(400).json({ success: false, message: 'USN and room type are required' });
        }

        // Check if student exists
        const [student] = await db.execute('SELECT usn FROM students WHERE usn = ?', [usn]);
        if (student.length === 0) {
            return res.status(400).json({ success: false, message: 'Student not found. Please register first.' });
        }

        // Check if student already has a pending application
        const [existing] = await db.execute(
            'SELECT id FROM room_applications WHERE usn = ? AND status = "pending"',
            [usn]
        );
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'You already have a pending room application' });
        }

        await db.execute(
            'INSERT INTO room_applications (usn, room_type, status, created_at) VALUES (?, ?, "pending", CURRENT_TIMESTAMP)',
            [usn, room_type]
        );
        res.json({ success: true, message: 'Application submitted successfully' });
    } catch (error) {
        console.error('Error submitting room application:', error);
        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            res.status(400).json({ success: false, message: 'Student not found. Please register first.' });
        } else {
            res.status(500).json({ success: false, message: 'Database error. Please try again later.' });
        }
    }
});

// Get room applications
app.get('/api/admin/room-applications', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT ra.*, s.name as student_name FROM room_applications ra JOIN students s ON ra.usn = s.usn WHERE ra.status = "pending"'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update request status
app.put('/api/admin/update-status', async (req, res) => {
    try {
        const { type, id, status, room_number } = req.body;
        let table;
        switch(type) {
            case 'roomRequests': table = 'room_applications'; break;
            case 'complaints': table = 'complaints'; break;
            case 'cleaningRequests': table = 'cleaning_requests'; break;
            default: throw new Error('Invalid request type');
        }
        
        if (type === 'roomRequests' && status === 'approved') {
            if (!room_number) {
                return res.status(400).json({ success: false, message: 'Room number is required for approval' });
            }
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

        await db.execute(
            'INSERT INTO cleaning_requests (usn, room_number, preferred_time, status) VALUES (?, ?, ?, "pending")',
            [usn, roomNumber, date]
        );
        
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