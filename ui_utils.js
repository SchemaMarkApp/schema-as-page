export function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.add('loading');
        element.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Processing...</p>
        `;
    }
}

export function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('loading');
        element.classList.add('error');
        element.innerHTML = `
            <div class="error-message">
                <h3>Error</h3>
                <p>${message}</p>
                <button onclick="window.location.reload()">Retry</button>
            </div>
        `;
    }
}

export function clearStatus(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.classList.remove('loading', 'error');
    }
}

export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}