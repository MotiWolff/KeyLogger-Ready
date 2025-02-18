document.addEventListener('DOMContentLoaded', () => {
    const osButtons = document.querySelectorAll('.os-type-item');
    const devicesSection = document.getElementById('devices');
    const logsSection = document.getElementById('logs');
    const historySection = document.getElementById('history');
    
    osButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (this.classList.contains('disabled')) {
                return;
            }
            
            // Remove active class from all buttons
            osButtons.forEach(btn => btn.classList.remove('active-os'));
            
            // Add active class to clicked button
            this.classList.add('active-os');
            
            const osType = this.dataset.os;
            
            // Show/hide relevant sections based on OS selection
            if (osType === 'macos') {
                devicesSection.style.display = 'block';
                logsSection.style.display = 'flex';
                historySection.style.display = 'block';
                
                // Dispatch OS selection event
                const event = new CustomEvent('osSelected', {
                    detail: { os: osType }
                });
                document.dispatchEvent(event);
            } else {
                devicesSection.style.display = 'none';
                logsSection.style.display = 'none';
                historySection.style.display = 'none';
            }
            
            // Store selected OS in session storage
            sessionStorage.setItem('selectedOS', osType);
        });
    });
    
    // Check for previously selected OS
    const selectedOS = sessionStorage.getItem('selectedOS');
    if (selectedOS) {
        const button = document.querySelector(`[data-os="${selectedOS}"]`);
        if (button && !button.classList.contains('disabled')) {
            button.click(); // Trigger the click event to restore the state
        }
    }
}); 