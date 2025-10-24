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
        const complaintsHTML = result.complaints.map(complaint => {
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
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('myComplaintsContainer')) {
        const complaintsTab = document.querySelector('.nav-item[onclick="switchTab(\'complaint\')"]');
        if (complaintsTab) {
            complaintsTab.addEventListener('click', function() {
                loadComplaints();
            });
        }
        if (document.getElementById('complaint').classList.contains('active')) {
            loadComplaints();
        }
    }
});