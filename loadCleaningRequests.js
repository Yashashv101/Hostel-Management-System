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
        const requestsHTML = result.requests.map(request => {
            let statusClass = '';
            let statusText = '';
            let workerInfo = '';
            
            switch(request.status) {
                case 'approved':
                    statusClass = 'status-approved';
                    statusText = 'Approved';
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
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('myCleaningRequestsContainer')) {
        const cleaningTab = document.querySelector('.nav-item[onclick="switchTab(\'cleaning\')"]');
        if (cleaningTab) {
            cleaningTab.addEventListener('click', function() {
                loadCleaningRequests();
            });
        }
        if (document.getElementById('cleaning').classList.contains('active')) {
            loadCleaningRequests();
        }
    }
});
