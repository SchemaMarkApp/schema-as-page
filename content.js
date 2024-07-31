console.log('Content script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractSchema') {
    const schemas = extractAllSchemas();
    console.log('Extracted schemas:', schemas);
    sendResponse({ schemas });
  } else if (request.action === 'getPageContent') {
    sendResponse({ content: document.documentElement.outerHTML });
  }
});

function extractAllSchemas() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  console.log('Found JSON-LD scripts:', scripts.length);
  return Array.from(scripts).map(script => {
    try {
      return JSON.parse(script.textContent);
    } catch (e) {
      console.error('Error parsing JSON-LD:', e);
      return null;
    }
  }).filter(schema => schema !== null);
}