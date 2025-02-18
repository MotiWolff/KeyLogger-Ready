let currentSessionLogs = [];
let isLogging = false;
let sessionStartTime = null;

function updateHistory(logEntries) {
    const historyList = document.querySelector('.history-entries');
    if (!historyList) return;
    
    historyList.innerHTML = '';
    
    // Display entries in reverse chronological order
    logEntries.slice().reverse().forEach(entry => {
        const entryElement = createHistoryEntry(entry);
        historyList.appendChild(entryElement);
    });
}

function createHistoryEntry(entry) {
    const entryDiv = document.createElement('div');
    entryDiv.className = 'history-entry';

    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'entry-timestamp';
    timestampDiv.textContent = entry.timestamp || 'Unknown Time';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'entry-content';
    contentDiv.textContent = entry.content || '';

    entryDiv.appendChild(timestampDiv);
    entryDiv.appendChild(contentDiv);

    return entryDiv;
}

function startLogging() {
    isLogging = true;
    sessionStartTime = new Date().toISOString().replace('T', ' ').substr(0, 19);
    currentSessionLogs = [];
    
    const logsElement = document.querySelector('.logs-pre');
    if (logsElement) {
        logsElement.textContent += `=== Logging started at ${sessionStartTime} ===\n`;
    }
}

function stopLogging() {
    if (isLogging) {
        const logsElement = document.querySelector('.logs-pre');
        if (logsElement) {
            // Store the complete session logs
            const historyEntry = {
                timestamp: sessionStartTime,
                content: logsElement.textContent.trim() // Ensure we get the actual content
            };
            
            // Retrieve existing history first
            let history = [];
            const storedHistory = localStorage.getItem('chatHistory');
            if (storedHistory) {
                history = JSON.parse(storedHistory);
            }
            
            // Add new entry and save back to localStorage
            history.push(historyEntry);
            localStorage.setItem('chatHistory', JSON.stringify(history));
            
            // Update display
            updateHistory(history);
        }
    }
    
    isLogging = false;
    sessionStartTime = null;
    currentSessionLogs = [];
}

function addToLogs(message) {
    if (isLogging) {
        currentSessionLogs.push(message);
    }
    // Add other logging logic...
}

function clearLogs() {
    const logsElement = document.querySelector('.logs-pre');
    if (logsElement) {
        const clearTime = new Date().toISOString().replace('T', ' ').substr(0, 19);
        logsElement.textContent = `=== Logs cleared at ${clearTime} ===\n`;
    }
    // Don't touch the history - removed any history-related code from here
}

// Load history when page loads
document.addEventListener('DOMContentLoaded', () => {
    const storedHistory = localStorage.getItem('chatHistory');
    if (storedHistory) {
        const history = JSON.parse(storedHistory);
        updateHistory(history);
    }
});

class HistoryManager {
    constructor() {
        this.historyForm = document.getElementById('history-form');
        this.historyOutput = document.getElementById('history-output');
        this.dateInput = document.getElementById('date-input');
        this.timeInput = document.getElementById('time-input');

        if (this.historyForm) {
            this.initializeEventListeners();
            this.initializeFilters();
        }
    }

    initializeFilters() {
        // Set default date to today
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        
        if (this.dateInput) {
            this.dateInput.value = `${year}-${month}-${day}`;
        }
        
        if (this.timeInput) {
            const hours = String(today.getHours()).padStart(2, '0');
            const minutes = String(today.getMinutes()).padStart(2, '0');
            this.timeInput.value = `${hours}:${minutes}`;
        }
    }

    initializeEventListeners() {
        this.historyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.fetchHistory();
        });
    }

    async fetchHistory() {
        try {
            const date = this.dateInput.value;
            const time = this.timeInput.value;
            
            const response = await fetch('/api/logs/history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ date, time })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.displayHistory(data.history);
            
        } catch (error) {
            console.error('Error fetching history:', error);
            this.displayError(error.message);
        }
    }

    displayHistory(history) {
        if (!this.historyOutput) return;

        if (history && history.length > 0) {
            const historyHtml = history.map(entry => `
                <div class="history-entry">
                    <div class="history-timestamp">${entry.timestamp}</div>
                    <div class="history-device">${entry.device}</div>
                    <div class="history-content">${entry.content}</div>
                </div>
            `).join('');
            
            this.historyOutput.innerHTML = historyHtml;
        } else {
            this.historyOutput.innerHTML = '<div class="no-history">No logs found for the selected criteria</div>';
        }
    }

    displayError(message) {
        if (this.historyOutput) {
            this.historyOutput.innerHTML = `<div class="error">Error: ${message}</div>`;
        }
    }
}

// Initialize history manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.historyManager = new HistoryManager();
}); 