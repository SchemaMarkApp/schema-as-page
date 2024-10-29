document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup DOM fully loaded');
  
  const processButton = document.getElementById('processSchemas');
  const rankButton = document.getElementById('rankSchemas');
  
  if (processButton) {
    processButton.addEventListener('click', function() {
      console.log('Process Schemas button clicked');
      this.textContent = 'Processing...';
      executeAction('processSchemas', 'split_view.html')
        .catch(error => {
          console.error('Error:', error);
          this.textContent = 'Process Schemas';
          alert(`Error: ${error.message}`);
        });
    });
  } else {
    console.error('Process Schemas button not found');
  }
  
  if (rankButton) {
    rankButton.addEventListener('click', function() {
      console.log('Rank Schemas button clicked');
      this.textContent = 'Ranking...';
      executeAction('rankSchemas', 'schema_ranker.html')
        .catch(error => {
          console.error('Error:', error);
          this.textContent = 'Rank Schemas';
          alert(`Error: ${error.message}`);
        });
    });
  } else {
    console.error('Rank Schemas button not found');
  }
});

async function executeAction(action, htmlFile) {
  console.log(`Executing action: ${action}`);
  
  try {
    // Get active tab
    const [activeTab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!activeTab?.url) {
      throw new Error('No active tab URL found');
    }

    // Set the URL in background script first
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'setOriginalTabUrl',
        url: activeTab.url
      }, (response) => {
        if (!response?.success) {
          reject(new Error('Failed to set original URL'));
          return;
        }
        resolve();
      });
    });

    // Send message to content script
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(activeTab.id, {
        action: action,
        currentUrl: activeTab.url
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || !response.schemas) {
          reject(new Error('Invalid response from content script'));
          return;
        }
        resolve(response);
      });
    });

    // Create new tab and pass URL
    const newTab = await chrome.tabs.create({
      url: chrome.runtime.getURL(htmlFile),
      active: true
    });

    // Wait for tab to load and send data with URL
    await new Promise((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 10;

      function sendMessageToNewTab() {
        if (retryCount >= maxRetries) {
          reject(new Error('Failed to send message after multiple attempts'));
          return;
        }

        chrome.tabs.sendMessage(newTab.id, {
          action: action,
          data: {
            schemas: response.schemas,
            pageTitle: response.pageTitle,
            pageDescription: response.pageDescription,
            homepageTitle: response.homepageTitle,
            url: activeTab.url,  // Explicitly include URL
            originalTabId: activeTab.id
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            retryCount++;
            setTimeout(sendMessageToNewTab, 100);
            return;
          }
          resolve();
        });
      }

      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          sendMessageToNewTab();
        }
      });
    });

  } catch (error) {
    console.error('Error executing action:', error);
    throw error;
  }
}