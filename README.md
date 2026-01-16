# Hostel Management System

A comprehensive web-based hostel management system built with Node.js, Express, MySQL, and vanilla JavaScript. This system provides an intuitive interface for managing hostel operations including student management, room allocation, complaint handling, cleaning requests, and lost & found items.

## 🏫 System Overview

The Hostel Management System is designed to streamline hostel operations with separate interfaces for administrators and students. It offers real-time management capabilities with a clean, responsive design that works across all devices.

## ✨ Key Features

### Student Portal
- **Complaint Management**: Submit and track maintenance complaints with priority levels
- **Cleaning Requests**: Schedule cleaning services with preferred time slots
- **Lost & Found**: Report lost items and browse found items database
- **Room Information**: View room details and occupancy status
- **Responsive Design**: Mobile-friendly interface for on-the-go access

### Admin Dashboard
- **Student Management**: Add, edit, and manage student records
- **Room Allocation**: Assign and manage room assignments
- **Complaint Processing**: Review and resolve student complaints
- **Worker Management**: Assign cleaning staff and track availability
- **Reporting**: View system statistics and generate reports

## 🛠️ Technology Stack

- **Backend**: Node.js with Express.js framework
- **Database**: MySQL with relational schema design
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Authentication**: Session-based authentication
- **UI Components**: Font Awesome icons, Flatpickr date picker
- **Responsive Design**: CSS Grid and Flexbox for mobile compatibility

## 📋 Prerequisites

- Node.js (v14 or higher)
- MySQL Server (v5.7 or higher)
- npm (Node Package Manager)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd hostel-management-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
```bash
# Login to MySQL
mysql -u root -p

# Create database and tables
source schema.sql
```

### 4. Configure Database Connection
Update the database configuration in `db_config.js`:
```javascript
const db = mysql.createConnection({
    host: 'localhost',
    user: 'your_mysql_username',
    password: 'your_mysql_password',
    database: 'hms_db'
});
```

### 5. Start the Server
```bash
npm start
# or
node server.js
```

### 6. Access the Application
- **Main Portal**: http://localhost:3000
- **Student Dashboard**: Login through the main portal
- **Admin Dashboard**: Access admin features after authentication

## 📁 Project Structure

```
hostel-management-system/
├── admin-pages/              # Admin-specific pages
│   └── students.html        # Student management interface
├── index.html               # Main login portal
├── student-dashboard.html   # Student dashboard (main interface)
├── admin-dashboard-fixed.html # Admin dashboard interface
├── server.js               # Express server and API routes
├── db_config.js            # Database connection configuration
├── schema.sql              # Database schema and initial data
├── styles.css              # Global CSS styles
├── loadComplaints.js       # Complaints loading functionality
├── loadCleaningRequests.js # Cleaning requests loading functionality
├── package.json            # Node.js dependencies
├── test-dashboard.html     # Testing interface for validation
└── DASHBOARD_FIXES_DOCUMENTATION.md # Detailed fix documentation
```

## 🔧 API Endpoints

### Authentication
- `POST /api/login` - Student/Admin login
- `POST /api/logout` - User logout
- `GET /api/check-auth` - Check authentication status

### Student Operations
- `POST /api/complaints` - Submit new complaint
- `GET /api/complaints/:usn` - Get student complaints
- `POST /api/cleaning-request` - Submit cleaning request
- `GET /api/cleaning-requests/:usn` - Get student cleaning requests
- `POST /api/lost-item` - Report lost item
- `GET /api/lost-items` - Get all lost items
- `PUT /api/lost-item/found` - Mark item as found

### Admin Operations
- `GET /api/students` - Get all students
- `POST /api/students` - Add new student
- `PUT /api/students/:usn` - Update student information
- `GET /api/available-workers` - Check worker availability
- `GET /api/stats` - Get system statistics

## 🧪 Testing

The system includes comprehensive testing capabilities:

1. **Syntax Validation**: Automated JavaScript syntax checking
2. **Form Validation**: Client-side validation for all input forms
3. **Function Testing**: Verification of core functionality
4. **Mobile Testing**: Responsive design validation

Run the test interface by opening `test-dashboard.html` in your browser.

## 🎯 Recent Improvements

### Dashboard Fixes (January 2026)
- **Enhanced Form Validation**: Added comprehensive validation for all three core functions
- **Error Handling**: Improved error messages and user feedback
- **Mobile Responsiveness**: Verified and maintained responsive design
- **Code Quality**: Fixed JavaScript syntax errors and improved code structure
- **User Experience**: Clearer navigation and form submission feedback

See `DASHBOARD_FIXES_DOCUMENTATION.md` for detailed information about all recent fixes and improvements.

## 🔒 Security Features

- **Input Validation**: All user inputs are validated and sanitized
- **SQL Injection Prevention**: Parameterized queries used throughout
- **Session Management**: Secure session-based authentication
- **Error Handling**: No sensitive information exposed in error messages

## 🚀 Deployment

For production deployment:

1. **Environment Variables**: Set up production database credentials
2. **SSL Certificate**: Configure HTTPS for secure communication
3. **Process Management**: Use PM2 or similar for process management
4. **Reverse Proxy**: Configure Nginx or Apache for better performance
5. **Database Backup**: Set up regular database backup procedures


## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check existing documentation
- Review the test cases for functionality verification

## 📊 System Statistics

The system provides real-time statistics for:
- Total students enrolled
- Room occupancy rates
- Pending complaints and requests
- Worker availability status
- Lost & found item status