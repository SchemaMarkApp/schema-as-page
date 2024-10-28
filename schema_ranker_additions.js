// Add this near the top of schema_ranker.js
function addControlPanel() {
    const controlPanel = document.createElement('div');
    controlPanel.className = 'control-panel';
    controlPanel.innerHTML = `
        <div class="controls">
            <button onclick="window.toggleView('grid')">Grid View</button>
            <button onclick="window.toggleView('stack')">Stack View</button>
            <button onclick="window.expandAll()">Expand All</button>
            <button onclick="window.collapseAll()">Collapse All</button>
            <select id="schemaFilter">
                <option value="all">All Schemas</option>
                <option value="organization">Organization</option>
                <option value="webpage">WebPage</option>
                <option value="website">WebSite</option>
            </select>
        </div>
    `;
    document.body.insertBefore(controlPanel, document.getElementById('content'));
}

// Add these to your window object
window.toggleView = function(type) {
    const content = document.getElementById('content');
    content.className = type === 'grid' ? 'grid-view' : 'stack-view';
};

window.expandAll = function() {
    document.querySelectorAll('.schema-box pre').forEach(pre => {
        pre.style.maxHeight = 'none';
    });
};

window.collapseAll = function() {
    document.querySelectorAll('.schema-box pre').forEach(pre => {
        pre.style.maxHeight = '200px';
    });
};

// Add this to the init function
document.getElementById('schemaFilter')?.addEventListener('change', function(e) {
    const value = e.target.value;
    const schemaBoxes = document.querySelectorAll('.schema-box');
    
    schemaBoxes.forEach(box => {
        if (value === 'all') {
            box.style.display = 'block';
        } else {
            const schemaContent = box.textContent.toLowerCase();
            box.style.display = schemaContent.includes(value) ? 'block' : 'none';
        }
    });
});