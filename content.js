chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractSchema') {
    const schemas = extractAllSchemas();
    sendResponse({ schemas });
  }
});

function extractAllSchemas() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  return Array.from(scripts).map(script => JSON.parse(script.textContent));
}