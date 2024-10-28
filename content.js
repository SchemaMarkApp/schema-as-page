window.addEventListener('error', (event) => {
  console.error('Content script error:', event.error);
});

console.log('Content script loaded');

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'checkUrlStatus') {
    checkUrlStatusWithTimeout(request.url)
      .then(status => sendResponse({ status }))
      .catch(error => sendResponse({ status: 'Error', error: error.message }));
    return true;
  }
  console.log('Content script received message:', request);

  if (request.action === 'processSchemas' || request.action === 'rankSchemas') {
    const schemas = extractAllSchemas();
    const metadata = getPageMetadata();
    console.log('Extracted schemas:', schemas);
    console.log('Page metadata:', metadata);
    sendResponse({
      schemas: schemas,
      pageTitle: metadata.title,
      pageDescription: metadata.description
    });
  } else if (request.action === 'checkInit') {
    sendResponse({ initialized: true });
  } else if (request.action === 'checkUrlStatus') {
    fetch(request.url, { method: 'HEAD', mode: 'no-cors' })
      .then(response => {
        sendResponse({ status: response.status });
      })
      .catch(error => {
        console.error('Error checking URL status:', error);
        sendResponse({ status: 'Error' });
      });
  } else if (request.action === 'getHomepageTitle') {
    fetch(request.url)
      .then(response => response.text())
      .then(text => {
        const titleMatch = text.match(/<title>(.*?)<\/title>/i);
        sendResponse({ title: titleMatch ? titleMatch[1].trim() : null });
      })
      .catch(error => {
        console.error('Error fetching homepage title:', error);
        sendResponse({ title: null });
      });
  } else if (request.action === 'getPageContent') {
    sendResponse({ content: document.documentElement.outerHTML });
  }
  return true; // Indicates we will send a response asynchronously
});

function getPageMetadata() {
  const ogTitle = document.querySelector('meta[property="og:title"]');
  const metaDescription = document.querySelector('meta[name="description"]');
  return {
    title: ogTitle ? ogTitle.getAttribute('content') : document.title || 'Page Title',
    description: metaDescription ? metaDescription.getAttribute('content') : ''
  };
}

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

async function getHomepageTitle(url) {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getHomepageTitle', url: new URL(url).origin }, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response.title);
        }
      });
    });
  } else {
    console.warn('Chrome runtime not available');
    return null;
  }
}

console.log('Content script setup complete');