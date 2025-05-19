// Function to load and display complaints with status labels
async function loadComplaints() {
    const currentStudent = JSON.parse(localStorage.getItem('currentStudent'));
    if (!currentStudent) return;
    
    const complaintsContainer = document.getElementById('myComplaintsContainer');
    complaintsContainer.innerHTML = '<div class="loading-message">Loading your complaints...</div>';
    
    try {
        const response = await fetch(`/api/complaints/${currentStudent.usn}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success || !result.complaints || result.complaints.length === 0) {
            complaintsContainer.innerHTML = '<div class="no-complaints">You have no complaints.</div>';
            return;
        }
        
        // Generate HTML for complaints with status labels
        const complaintsHTML = result.complaints.map(complaint => {
            // Determine status class and text based on complaint status
            let statusClass = '';
            let statusText = '';
            
            switch(complaint.status) {
                case 'approved':
                    statusClass = 'status-approved';
                    statusText = 'Approved';
                    break;
                case 'rejected':
                    statusClass = 'status-rejected';
                    statusText = 'Rejected';
                    break;
                case 'resolved':
                    statusClass = 'status-resolved';
                    statusText = 'Resolved';
                    break;
                default:
                    statusClass = 'status-pending';
                    statusText = 'Pending';
            }
            
            // Format the date
            const date = new Date(complaint.created_at).toLocaleDateString();
            const time = new Date(complaint.created_at).toLocaleTimeString();
            
            return `
                <div class="complaint-item">
                    <div class="complaint-header">
                        <div class="complaint-type">${complaint.type || 'General'}</div>
                        <div class="complaint-status ${statusClass}">${statusText}</div>
                    </div>
                    <div class="complaint-content">${complaint.complaint_text}</div>
                    <div class="complaint-date">${date} at ${time}</div>
                </div>
            `;
        }).join('');
        
        complaintsContainer.innerHTML = complaintsHTML;
        
        // Add CSS for status labels if not already in styles.css
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .complaint-status {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                font-weight: 500;
            }
            .status-pending {
                background-color: #f0ad4e;
                color: #fff;
            }
            .status-approved {
                background-color: #5cb85c;
                color: #fff;
            }
            .status-rejected {
                background-color: #d9534f;
                color: #fff;
            }
            .status-resolved {
                background-color: #5bc0de;
                color: #fff;
            }
        `;
        document.head.appendChild(styleElement);
        
    } catch (error) {
        console.error('Error loading complaints:', error);
        complaintsContainer.innerHTML = '<div class="error-message">Error loading complaints. Please try again.</div>';
    }
}

// Add this function to the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the student dashboard page
    if (document.getElementById('myComplaintsContainer')) {
        // Add tab switching event for complaints tab
        const complaintsTab = document.querySelector('.nav-item[onclick="switchTab(\'complaint\')"]');
        if (complaintsTab) {
            complaintsTab.addEventListener('click', function() {
                loadComplaints();
            });
        }
        
        // Load complaints if we're already on the complaints tab
        if (document.getElementById('complaint').classList.contains('active')) {
            loadComplaints();
        }
    }
});

// Instructions for implementation:
// 1. Add this JavaScript file to your project
// 2. Include it in your student-dashboard.html with:
//    <script src="loadComplaints.js"></script>
// 3. Make sure to call loadComplaints() when the complaints tab is clicked
// 4. Update your server.js to return the status field in the complaints API response
// 5. Ensure your database has a 'status' field in the complaints table that can be:
//    - 'pending' (default for new complaints)
//    - 'approved' (when admin approves)
//    - 'rejected' (when admin rejects)
//    - 'resolved' (when admin resolves)