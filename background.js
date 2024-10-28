// Service worker context
self.addEventListener('error', (event) => { 
  console.error('Service worker error:', event.error);
  // Implement error reporting/logging 
}); 

// Initialize cache and state
const urlStatusCache = new Map(); 
let originalTabUrl = ''; 

// Add cache cleanup every hour 
const CACHE_CLEANUP_INTERVAL = 3600000;
setInterval(() => {
  console.log('Clearing URL status cache');
  urlStatusCache.clear();
}, CACHE_CLEANUP_INTERVAL); 

// Utility functions
function sanitizeUrl(url) { 
  try { 
    const parsed = new URL(url); 
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
    return parsed.toString(); 
  } catch (e) { 
    console.error('Invalid URL:', url, e.message); 
    return null; 
  } 
}

async function getCachedUrlStatus(url) { 
  const sanitizedUrl = sanitizeUrl(url);
  if (!sanitizedUrl) {
    return { status: 'Error', error: 'Invalid URL' };
  }

  if (urlStatusCache.has(sanitizedUrl)) { 
    return urlStatusCache.get(sanitizedUrl); 
  } 

  try {
    const status = await checkUrlStatusWithTimeout(sanitizedUrl); 
    urlStatusCache.set(sanitizedUrl, status); 
    return status;
  } catch (error) {
    console.error('Error checking URL status:', error);
    return { status: 'Error', error: error.message };
  }
}

async function checkUrlStatusWithTimeout(url, timeout = 5000) { 
  const controller = new AbortController(); 
  const timeoutId = setTimeout(() => controller.abort(), timeout); 
  
  try { 
    const response = await self.fetch(url, { 
      method: 'HEAD', 
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }); 
    return { status: response.status }; 
  } catch (error) { 
    if (error.name === 'AbortError') { 
      return { status: 'Timeout', error: 'Request timed out' }; 
    } 
    return { status: 'Error', error: error.message }; 
  } finally { 
    clearTimeout(timeoutId); 
  } 
}

async function fetchHomepageTitle(url) { 
  const sanitizedUrl = sanitizeUrl(url);
  if (!sanitizedUrl) {
    return { title: null, error: 'Invalid URL' };
  }

  try { 
    const response = await self.fetch(sanitizedUrl, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }); 
    const text = await response.text(); 
    const titleMatch = text.match(/<title>(.*?)<\/title>/i); 
    return { title: titleMatch ? titleMatch[1].trim() : null }; 
  } catch (error) { 
    console.error('Error fetching homepage:', error); 
    return { title: null, error: error.message }; 
  } 
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => { 
  console.log('Background script received message:', request.action);

  // Handle different message types
  switch (request.action) {
    case 'checkUrlStatus': 
      handleUrlStatusCheck(request, sendResponse);
      break;
    
    case 'setOriginalTabUrl': 
      handleSetOriginalUrl(request, sendResponse);
      break;
    
    case 'getOriginalTabUrl': 
      handleGetOriginalUrl(sendResponse);
      break;
    
    case 'getHomepageTitle': 
      handleGetHomepageTitle(request, sendResponse);
      break;

    default:
      console.warn('Unknown message action:', request.action);
      sendResponse({ error: 'Unknown action' });
      return false;
  }

  return true; // Keep message channel open for async responses
});

// Message handlers
async function handleUrlStatusCheck(request, sendResponse) {
  const sanitizedUrl = sanitizeUrl(request.url); 
  if (!sanitizedUrl) { 
    sendResponse({ status: 'Error', error: 'Invalid URL' }); 
    return;
  } 
  
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs.length) {
      throw new Error('No active tab found');
    }

    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'checkUrlStatus', 
      url: sanitizedUrl
    });
    
    sendResponse(response);
  } catch (error) {
    console.error('Error in URL status check:', error);
    sendResponse({ status: 'Error', error: error.message });
  }
}

function handleSetOriginalUrl(request, sendResponse) {
  originalTabUrl = sanitizeUrl(request.url) || '';
  console.log('Original tab URL set to:', originalTabUrl);
  sendResponse({ success: true, url: originalTabUrl });
}

function handleGetOriginalUrl(sendResponse) {
  sendResponse({ url: originalTabUrl });
}

async function handleGetHomepageTitle(request, sendResponse) {
  try {
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs.length) {
      throw new Error('No active tab found');
    }

    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'getHomepageTitle', 
      url: request.url
    });
    
    sendResponse(response);
  } catch (error) {
    console.error('Error getting homepage title:', error);
    sendResponse({ title: null, error: error.message });
  }
}

// Installation and update handling
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(clients.claim());
});

console.log('Background service worker loaded');