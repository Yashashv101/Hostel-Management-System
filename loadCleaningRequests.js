// Function to load and display cleaning requests with status labels
async function loadCleaningRequests() {
    const currentStudent = JSON.parse(localStorage.getItem('currentStudent'));
    if (!currentStudent) return;
    
    const cleaningRequestsContainer = document.getElementById('myCleaningRequestsContainer');
    cleaningRequestsContainer.innerHTML = '<div class="loading-message">Loading your cleaning requests...</div>';
    
    try {
        const response = await fetch(`/api/cleaning-requests/${currentStudent.usn}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success || !result.requests || result.requests.length === 0) {
            cleaningRequestsContainer.innerHTML = '<div class="no-requests">You have no cleaning requests.</div>';
            return;
        }
        
        // Generate HTML for cleaning requests with status labels
        const requestsHTML = result.requests.map(request => {
            // Determine status class and text based on request status
            let statusClass = '';
            let statusText = '';
            let workerInfo = '';
            
            switch(request.status) {
                case 'approved':
                    statusClass = 'status-approved';
                    statusText = 'Approved';
                    // Display worker information if available
                    if (request.worker_name && request.worker_id) {
                        workerInfo = `
                            <div class="worker-info">
                                <span class="worker-label">Assigned Worker:</span>
                                <span class="worker-name">${request.worker_name} (ID: ${request.worker_id})</span>
                            </div>
                        `;
                    }
                    break;
                case 'rejected':
                    statusClass = 'status-rejected';
                    statusText = 'Rejected';
                    break;
                case 'completed':
                    statusClass = 'status-completed';
                    statusText = 'Completed';
                    break;
                default:
                    statusClass = 'status-pending';
                    statusText = 'Pending';
            }
            
            // Format the date and time
            const date = new Date(request.preferred_time).toLocaleDateString();
            const time = new Date(request.preferred_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            return `
                <div class="cleaning-request-item">
                    <div class="request-header">
                        <div class="request-room">Room: ${request.room_number}</div>
                        <div class="request-status ${statusClass}">${statusText}</div>
                    </div>
                    <div class="request-time">Requested for: ${date} at ${time}</div>
                    ${request.notes ? `<div class="request-notes">Notes: ${request.notes}</div>` : ''}
                    ${workerInfo}
                    <div class="request-date">Submitted on: ${new Date(request.created_at).toLocaleDateString()}</div>
                </div>
            `;
        }).join('');
        
        cleaningRequestsContainer.innerHTML = requestsHTML;
        
        // Add CSS for status labels if not already in styles.css
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .cleaning-request-item {
                background-color: #292929;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }
            .request-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            .request-room {
                font-weight: 600;
                font-size: 1rem;
            }
            .request-status {
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
            .status-completed {
                background-color: #5bc0de;
                color: #fff;
            }
            .request-time {
                font-weight: 500;
                margin-bottom: 8px;
            }
            .request-notes {
                background-color: rgba(255, 255, 255, 0.05);
                padding: 8px;
                border-radius: 4px;
                margin-bottom: 8px;
                font-style: italic;
            }
            .request-date {
                font-size: 0.8rem;
                color: #aaa;
            }
            .worker-info {
                background-color: rgba(92, 184, 92, 0.1);
                padding: 8px;
                border-radius: 4px;
                margin: 8px 0;
                border-left: 3px solid #5cb85c;
            }
            .worker-label {
                font-weight: 600;
                margin-right: 5px;
            }
            .worker-name {
                color: #fff;
            }
        `;
        document.head.appendChild(styleElement);
        
    } catch (error) {
        console.error('Error loading cleaning requests:', error);
        cleaningRequestsContainer.innerHTML = '<div class="error-message">Error loading cleaning requests. Please try again.</div>';
    }
}

// Add this function to the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the student dashboard page
    if (document.getElementById('myCleaningRequestsContainer')) {
        // Add tab switching event for cleaning tab
        const cleaningTab = document.querySelector('.nav-item[onclick="switchTab(\'cleaning\')"]');
        if (cleaningTab) {
            cleaningTab.addEventListener('click', function() {
                loadCleaningRequests();
            });
        }
        
        // Load cleaning requests if we're already on the cleaning tab
        if (document.getElementById('cleaning').classList.contains('active')) {
            loadCleaningRequests();
        }
    }
});

// Instructions for implementation:
// 1. Add this JavaScript file to your project
// 2. Include it in your student-dashboard.html with:
//    <script src="loadCleaningRequests.js"></script>
// 3. Make sure to call loadCleaningRequests() when the cleaning tab is clicked
// 4. Update your server.js to return the worker information in the cleaning requests API response
// 5. Ensure your database has a 'status' field in the cleaning_requests table that can be:
//    - 'pending' (default for new requests)
//    - 'approved' (when admin approves and assigns a worker)
//    - 'rejected' (when admin rejects)
//    - 'completed' (when cleaning is done)
// 6. Update the server.js endpoint for /api/cleaning-requests/:usn to include worker information
//    by joining with the workers table when status is 'approved'