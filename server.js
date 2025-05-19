const express = require('express');
const db = require('./db_config');
const app = express();
const path = require('path');
const port = 3000;

app.use(express.json());

// Default route should serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static files after route definitions
app.use(express.static(__dirname));

// Other routes (like admin.html)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard-fixed.html'));
});



// API endpoint for admin to get all students
app.get('/api/admin/students', async (req, res) => {
  try {
    // Get all students with their room information
    const [students] = await db.execute(
      `SELECT s.usn, s.name, s.branch, s.phone_number, r.room_number, r.block 
       FROM students s 
       LEFT JOIN rooms r ON s.room_id = r.room_id 
       ORDER BY s.name`
    );
    
    res.json(students);
  } catch (error) {
    console.error('Error fetching students data for admin:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// Create notices table if it doesn't exist
db.execute(`
  CREATE TABLE IF NOT EXISTS notices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(err => console.error('Error creating notices table:', err));

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
        const { type, id, status, room_number, worker_id } = req.body;
        
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
        
        if (type === 'cleaningRequests') {
            // For rejected cleaning requests, simply update the status without worker assignment
            if (status === 'rejected') {
                // Get the cleaning request to check if a worker was assigned
                const [cleaningRequest] = await db.execute(
                    'SELECT worker_id FROM cleaning_requests WHERE id = ?',
                    [id]
                );
                
                // If a worker was assigned, update their availability
                if (cleaningRequest.length > 0 && cleaningRequest[0].worker_id) {
                    await db.execute(
                        'UPDATE workers SET assigned_date = NULL, is_available = TRUE WHERE id = ?',
                        [cleaningRequest[0].worker_id]
                    );
                }
                
                // Update the cleaning request status
                await db.execute(
                    `UPDATE ${table} SET status = ?, worker_id = NULL WHERE id = ?`,
                    [status, id]
                );
                
                return res.json({ success: true, message: 'Cleaning request rejected successfully' });
            }
            
            // For completed (approved) cleaning requests, assign a worker
            if (status === 'completed') {
                // Validate worker_id is provided for cleaning requests
                if (!worker_id) {
                    return res.status(400).json({ success: false, message: 'Worker ID is required for cleaning requests' });
                }
                
                // Get the cleaning request details
                const [cleaningRequest] = await db.execute(
                    'SELECT preferred_time, room_number FROM cleaning_requests WHERE id = ?',
                    [id]
                );
                
                if (cleaningRequest.length === 0) {
                    return res.status(404).json({ success: false, message: 'Cleaning request not found' });
                }
                
                // Format the assignment date and time for display
                const assignmentDate = new Date(cleaningRequest[0].preferred_time);
                const formattedDate = assignmentDate.toLocaleDateString();
                const formattedTime = assignmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                // Get a connection from the pool for transaction
                const connection = await db.getConnection();
                
                try {
                    // Start transaction
                    await connection.beginTransaction();
                    
                    // Create a new worker assignment record
                    const [assignmentResult] = await connection.execute(
                        'INSERT INTO worker_assignments (worker_id, cleaning_request_id, room_number, assignment_date, time_slot, status) VALUES (?, ?, ?, DATE(?), TIME(?), "pending")',
                        [worker_id, id, cleaningRequest[0].room_number, assignmentDate, assignmentDate]
                    );
                    
                    const assignmentId = assignmentResult.insertId;
                    
                    // Update the cleaning request with the assigned worker and assignment ID
                    await connection.execute(
                        `UPDATE ${table} SET status = ?, worker_id = ?, assignment_id = ? WHERE id = ?`,
                        [status, worker_id, assignmentId, id]
                    );
                    
                    // Update worker's availability
                    await connection.execute(
                        'UPDATE workers SET is_available = FALSE WHERE id = ?',
                        [worker_id]
                    );
                    
                    await connection.commit();
                    
                    // Return additional information about the assignment
                    return res.json({ 
                        success: true, 
                        message: 'Cleaning request completed and worker assigned',
                        assignment: {
                            room_number: cleaningRequest[0].room_number,
                            date: formattedDate,
                            time: formattedTime
                        }
                    });
                } catch (error) {
                    await connection.rollback();
                    throw error;
                } finally {
                    // Release the connection back to the pool
                    connection.release();
                }
            }
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
            'SELECT c.*, s.name as student_name, r.room_number FROM complaints c JOIN students s ON c.usn = s.usn LEFT JOIN rooms r ON s.room_id = r.room_id WHERE c.status = "pending"'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Get cleaning requests
app.get('/api/admin/cleaning-requests', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT cr.*, s.name as student_name, DATE(cr.preferred_time) as request_date, TIME_FORMAT(TIME(cr.preferred_time), "%h:%i %p") as request_time FROM cleaning_requests cr JOIN students s ON cr.usn = s.usn WHERE cr.status = "pending"'
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete student (Admin only)
app.delete('/api/admin/delete-student', async (req, res) => {
    try {
        const { usn } = req.body;
        
        if (!usn) {
            return res.status(400).json({ success: false, message: 'USN is required' });
        }
        
        // Check if student exists
        const [student] = await db.execute('SELECT room_id FROM students WHERE usn = ?', [usn]);
        
        if (student.length === 0) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        
        const roomId = student[0].room_id;
        
        // Get a connection from the pool for transaction
        const connection = await db.getConnection();
        
        try {
            // Start transaction
            await connection.beginTransaction();
            // First delete any associated cleaning requests to handle foreign key constraints
            await connection.execute('DELETE FROM lost_items WHERE usn = ?', [usn]);
            await connection.execute('DELETE FROM cleaning_requests WHERE usn = ?', [usn]);
            
            // Then delete any complaints
            await connection.execute('DELETE FROM complaints WHERE usn = ?', [usn]);
            
            // Remove student from room_occupants
            await connection.execute('DELETE FROM room_occupants WHERE student_usn = ?', [usn]);
            // Delete student from students table
            await connection.execute('DELETE FROM students WHERE usn = ?', [usn]);
            
            
            // Update room occupancy if student was assigned to a room
            if (roomId) {
                await connection.execute(
                    'UPDATE rooms SET current_occupancy = (SELECT COUNT(*) FROM room_occupants WHERE room_id = ?), status = CASE WHEN (SELECT COUNT(*) FROM room_occupants WHERE room_id = ?) >= 3 THEN "full" ELSE "available" END WHERE room_id = ?',
                    [roomId, roomId, roomId]
                );
            }
            
            await connection.commit();
            res.json({ success: true, message: 'Student deleted successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            // Release the connection back to the pool
            connection.release();
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ success: false, message: 'Database error. Please try again later.' });
    }
});

// Publish notice (Admin only)
app.post('/api/admin/publish-notice', async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({ success: false, message: 'Notice content is required' });
        }
        
        // Get a connection from the pool for better error handling
        const connection = await db.getConnection();
        
        try {
            // Start transaction
            await connection.beginTransaction();
            
            // Insert notice
            await connection.execute(
                'INSERT INTO notices (content) VALUES (?)',
                [content]
            );
            
            await connection.commit();
            res.json({ success: true, message: 'Notice published successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            // Release the connection back to the pool
            connection.release();
        }
    } catch (error) {
        console.error('Error publishing notice:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

// Get all notices
app.get('/api/notices', async (req, res) => {
    try {
        const [rows] = await db.execute(
            'SELECT * FROM notices ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching notices:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Publish notice (Admin only)
app.post('/api/admin/publish-notice', async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({ success: false, message: 'Notice content is required' });
        }
        
        // Insert notice
        await db.execute(
            'INSERT INTO notices (content) VALUES (?)',
            [content]
        );
        
        res.json({ success: true, message: 'Notice published successfully' });
    } catch (error) {
        console.error('Error publishing notice:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
});

// Get available workers for a specific date and time slot
app.get('/api/available-workers', async (req, res) => {
    try {
        const { date, timeSlot } = req.query;
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is required' });
        }

        // Check for available workers based on is_available flag and worker_assignments table
        // If timeSlot is provided, also check for workers not assigned to that specific time slot
        let query = `
            SELECT w.id, w.name FROM workers w 
            WHERE w.is_available = TRUE AND NOT EXISTS (
                SELECT 1 FROM worker_assignments wa 
                WHERE wa.worker_id = w.id 
                AND wa.assignment_date = ? 
                AND wa.status = 'pending'`;
        
        let params = [date];
        
        if (timeSlot) {
            // For a specific time slot, exclude workers assigned to this exact time
            query += ` AND wa.time_slot = ?`;
            params.push(timeSlot);
        }
        
        query += `)`;
        
        const [availableWorkers] = await db.execute(query, params);

        res.json({ success: true, available: availableWorkers.length > 0, workers: availableWorkers });
    } catch (error) {
        console.error('Error checking worker availability:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Legacy function for backward compatibility - uses the new worker_assignments table
// instead of the removed assigned_date column
app.get('/api/available-workers-legacy', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ success: false, message: 'Date is required' });
        }

        // Use the new worker_assignments table instead of the removed assigned_date column
        const query = `
            SELECT id, name FROM workers WHERE is_available = TRUE AND NOT EXISTS (
                SELECT 1 FROM worker_assignments 
                WHERE worker_id = workers.id 
                AND assignment_date = ?
            )`;
        
        const [availableWorkers] = await db.execute(query, [date]);

        res.json({ success: true, available: availableWorkers.length > 0, workers: availableWorkers });
    } catch (error) {
        console.error('Error checking worker availability:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Submit cleaning request
app.post('/api/cleaning-request', async (req, res) => {
    try {
        const { usn, date, timeSlot, notes } = req.body;

        if (!usn || !date || !timeSlot) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        
        // Get student's room number from the database
        const [studentData] = await db.execute('SELECT room_id FROM students WHERE usn = ?', [usn]);
        if (studentData.length === 0) {
            return res.status(400).json({ success: false, message: 'Student not found' });
        }
        
        // Get room number from room_id
        const [roomData] = await db.execute('SELECT room_number FROM rooms WHERE room_id = ?', [studentData[0].room_id]);
        if (roomData.length === 0) {
            return res.status(400).json({ success: false, message: 'Room not found for this student' });
        }
        
        const roomNumber = roomData[0].room_number;

        const [student] = await db.execute('SELECT usn FROM students WHERE usn = ?', [usn]);
        if (student.length === 0) {
            return res.status(400).json({ success: false, message: 'Student not found' });
        }

        // Combine date and time slot into a datetime string
        const preferredDateTime = `${date} ${timeSlot}`;

        // Simply insert the cleaning request without assigning a worker
        // Worker will be assigned only when admin approves the request
        await db.execute(
            'INSERT INTO cleaning_requests (usn, room_number, preferred_time, status) VALUES (?, ?, ?, "pending")',
            [usn, roomNumber, preferredDateTime]
        );
        
        res.json({ success: true, message: 'Cleaning request submitted' });
    } catch (error) {
        console.error('Error submitting cleaning request:', error);
        res.status(500).json({ success: false, message: 'Database error' });
    }
});

// Submit lost item request
app.post('/api/lost-item', async (req, res) => {
    try {
        const { usn, item_name, description, location } = req.body;

        // Validate input
        if (!usn || !item_name) {
            return res.status(400).json({ success: false, message: 'USN and item name are required' });
        }

        // Check if student exists
        const [student] = await db.execute('SELECT usn, name, room_id FROM students WHERE usn = ?', [usn]);
        if (student.length === 0) {
            return res.status(400).json({ success: false, message: 'Student not found. Please register first.' });
        }

        await db.execute(
            'INSERT INTO lost_items (usn, item_name, description, location, status) VALUES (?, ?, ?, ?, "pending")',
            [usn, item_name, description || '', location || '']
        );
        res.json({ success: true, message: 'Lost item request submitted successfully' });
    } catch (error) {
        console.error('Error submitting lost item request:', error);
        res.status(500).json({ success: false, message: 'Database error. Please try again later.' });
    }
});

// Get all lost items
app.get('/api/lost-items', async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT li.*, s.name as student_name, r.room_number 
            FROM lost_items li 
            JOIN students s ON li.usn = s.usn 
            LEFT JOIN rooms r ON s.room_id = r.room_id 
            WHERE li.status = "pending"`
        );
        res.json(rows);
    } catch (error) {
        console.error('Error fetching lost items:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Mark item as found
app.put('/api/lost-item/found', async (req, res) => {
    try {
        const { id, finder_usn } = req.body;
        
        if (!id || !finder_usn) {
            return res.status(400).json({ success: false, message: 'Item ID and finder USN are required' });
        }
        
        // Check if the lost item exists and is still pending
        const [lostItem] = await db.execute('SELECT usn FROM lost_items WHERE id = ? AND status = "pending"', [id]);
        if (lostItem.length === 0) {
            return res.status(404).json({ success: false, message: 'Lost item not found or already resolved' });
        }
        
        // Check if finder exists
        const [finder] = await db.execute('SELECT name, phone_number FROM students WHERE usn = ?', [finder_usn]);
        if (finder.length === 0) {
            return res.status(400).json({ success: false, message: 'Finder student not found' });
        }
        
        // Update the lost item status
        await db.execute(
            'UPDATE lost_items SET status = "found", finder_usn = ? WHERE id = ?',
            [finder_usn, id]
        );
        
        res.json({ 
            success: true, 
            message: 'Item marked as found', 
            finder: {
                name: finder[0].name,
                phone_number: finder[0].phone_number
            }
        });
    } catch (error) {
        console.error('Error marking item as found:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get lost items for a specific student
app.get('/api/student/lost-items/:usn', async (req, res) => {
    try {
        const { usn } = req.params;
        
        const [items] = await db.execute(
            `SELECT li.*, 
            CASE 
                WHEN li.finder_usn IS NOT NULL THEN 
                    (SELECT JSON_OBJECT('name', s.name, 'phone_number', s.phone_number) 
                     FROM students s WHERE s.usn = li.finder_usn) 
                ELSE NULL 
            END as finder_info 
            FROM lost_items li 
            WHERE li.usn = ?`,
            [usn]
        );
        
        // The finder_info is already a JSON object from the database query
        const formattedItems = items.map(item => ({
            ...item,
            finder_info: item.finder_info
        }));
        
        res.json(formattedItems);
    } catch (error) {
        console.error('Error fetching student\'s lost items:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Cancel lost item request (for when student finds their own item)
app.delete('/api/student/lost-item/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { usn } = req.body;
        
        if (!id || !usn) {
            return res.status(400).json({ success: false, message: 'Item ID and student USN are required' });
        }
        
        // Verify the item belongs to the student making the request
        const [lostItem] = await db.execute('SELECT usn FROM lost_items WHERE id = ?', [id]);
        
        if (lostItem.length === 0) {
            return res.status(404).json({ success: false, message: 'Lost item not found' });
        }
        
        if (lostItem[0].usn !== usn) {
            return res.status(403).json({ success: false, message: 'You can only cancel your own lost item requests' });
        }
        
        // Delete the lost item
        await db.execute('DELETE FROM lost_items WHERE id = ?', [id]);
        
        res.json({ success: true, message: 'Lost item request cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling lost item request:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all workers
app.get('/api/admin/workers', async (req, res) => {
    try {
        const [workers] = await db.execute('SELECT * FROM workers');
        res.json(workers);
    } catch (error) {
        console.error('Error fetching workers:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add new worker
app.post('/api/admin/add-worker', async (req, res) => {
    try {
        const { name, phone_number } = req.body;
        
        if (!name || !phone_number) {
            return res.status(400).json({ success: false, message: 'Name and phone number are required' });
        }
        
        await db.execute(
            'INSERT INTO workers (name, phone_number, is_available) VALUES (?, ?, TRUE)',
            [name, phone_number]
        );
        
        res.json({ success: true, message: 'Worker added successfully' });
    } catch (error) {
        console.error('Error adding worker:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete worker
app.delete('/api/admin/delete-worker', async (req, res) => {
    try {
        const { id } = req.body;
        
        if (!id) {
            return res.status(400).json({ success: false, message: 'Worker ID is required' });
        }
        
        // Check if worker exists
        const [worker] = await db.execute('SELECT id FROM workers WHERE id = ?', [id]);
        
        if (worker.length === 0) {
            return res.status(404).json({ success: false, message: 'Worker not found' });
        }
        
        // Check if worker is assigned to any cleaning requests
        const [assignedRequests] = await db.execute(
            'SELECT id FROM cleaning_requests WHERE worker_id = ? AND status = "pending"',
            [id]
        );
        
        if (assignedRequests.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot delete worker with pending cleaning requests. Please reassign or complete the requests first.' 
            });
        }
        
        // Delete the worker
        await db.execute('DELETE FROM workers WHERE id = ?', [id]);
        
        res.json({ success: true, message: 'Worker deleted successfully' });
    } catch (error) {
        console.error('Error deleting worker:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update worker status for expired assignments
app.post('/api/admin/update-worker-status', async (req, res) => {
    try {
        const { worker_ids } = req.body;
        
        if (!worker_ids || !Array.isArray(worker_ids) || worker_ids.length === 0) {
            return res.status(400).json({ success: false, message: 'Worker IDs array is required' });
        }
        
        // Get a connection from the pool for transaction
        const connection = await db.getConnection();
        
        try {
            // Start transaction
            await connection.beginTransaction();
            
            // Mark expired assignments as completed
            await connection.execute(
                'UPDATE worker_assignments SET status = "completed" WHERE worker_id IN (?) AND assignment_date < CURDATE() AND status = "pending"',
                [worker_ids]
            );
            
            // Update workers availability
            await connection.execute(
                'UPDATE workers SET is_available = TRUE WHERE id IN (?) AND id NOT IN (SELECT DISTINCT worker_id FROM worker_assignments WHERE status = "pending")',
                [worker_ids]
            );
            
            await connection.commit();
            res.json({ success: true, message: 'Worker status updated successfully' });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            // Release the connection back to the pool
            connection.release();
        }
    } catch (error) {
        console.error('Error updating worker status:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get worker assignments history
app.get('/api/admin/worker-assignments', async (req, res) => {
    try {
        const [assignments] = await db.execute(
            `SELECT wa.*, w.name as worker_name, cr.usn, s.name as student_name 
            FROM worker_assignments wa 
            JOIN workers w ON wa.worker_id = w.id 
            LEFT JOIN cleaning_requests cr ON wa.cleaning_request_id = cr.id 
            LEFT JOIN students s ON cr.usn = s.usn 
            ORDER BY wa.assignment_date DESC, wa.time_slot DESC`
        );
        
        res.json(assignments);
    } catch (error) {
        console.error('Error fetching worker assignments:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get complaints for a specific student by USN
app.get('/api/complaints/:usn', async (req, res) => {
    try {
        const { usn } = req.params;
        
        if (!usn) {
            return res.status(400).json({ success: false, message: 'Student USN is required' });
        }
        
        const [complaints] = await db.execute(
            'SELECT * FROM complaints WHERE usn = ? ORDER BY created_at DESC',
            [usn]
        );
        
        res.json({ success: true, complaints });
    } catch (error) {
        console.error('Error fetching student complaints:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get cleaning requests for a specific student by USN
app.get('/api/cleaning-requests/:usn', async (req, res) => {
    try {
        const { usn } = req.params;
        
        if (!usn) {
            return res.status(400).json({ success: false, message: 'Student USN is required' });
        }
        
        const [requests] = await db.execute(
            'SELECT * FROM cleaning_requests WHERE usn = ? ORDER BY preferred_time DESC',
            [usn]
        );
        
        res.json({ success: true, requests });
    } catch (error) {
        console.error('Error fetching student cleaning requests:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});