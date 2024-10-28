document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup DOM fully loaded');
  
  const processButton = document.getElementById('processSchemas');
  const rankButton = document.getElementById('rankSchemas');
  
  if (processButton) {
      processButton.addEventListener('click', function() {
          console.log('Process Schemas button clicked');
          this.textContent = 'Processing...';
          executeAction('processSchemas', 'split_view.html');
      });
  } else {
      console.error('Process Schemas button not found');
  }
  
  if (rankButton) {
      rankButton.addEventListener('click', function() {
          console.log('Rank Schemas button clicked');
          this.textContent = 'Ranking...';
          executeAction('rankSchemas', 'schema_ranker.html');
      });
  } else {
      console.error('Rank Schemas button not found');
  }
});

async function executeAction(action, htmlFile) {
  console.log(`Executing action: ${action}`);
  
  try {
      // Get active tab
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tabs || tabs.length === 0) {
          throw new Error('No active tab found');
      }
      const activeTab = tabs[0];
      console.log('Active tab:', activeTab);

      // Send message to content script
      const response = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(activeTab.id, {action: action}, function(response) {
              if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
              } else if (!response || !response.schemas) {
                  reject(new Error('Invalid response from content script'));
              } else {
                  resolve(response);
              }
          });
      });

      // Create new tab
      const newTab = await new Promise((resolve, reject) => {
          chrome.tabs.create({
              url: chrome.runtime.getURL(htmlFile),
              active: true
          }, function(tab) {
              if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
              } else {
                  resolve(tab);
              }
          });
      });

      // Wait for tab to load and send message
      await new Promise((resolve, reject) => {
          function sendMessageToNewTab(retryCount = 0) {
              if (retryCount > 10) {
                  reject(new Error('Failed to send message after 10 retries'));
                  return;
              }

              chrome.tabs.sendMessage(newTab.id, {
                  action: action,
                  data: {
                      schemas: response.schemas,
                      pageTitle: response.pageTitle,
                      pageDescription: response.pageDescription,
                      homepageTitle: response.homepageTitle,
                      originalTabId: activeTab.id
                  }
              }, function(response) {
                  if (chrome.runtime.lastError) {
                      console.warn(`Retry ${retryCount + 1}: ${chrome.runtime.lastError.message}`);
                      setTimeout(() => sendMessageToNewTab(retryCount + 1), 100);
                  } else {
                      console.log('Data sent successfully to new tab');
                      resolve();
                  }
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
      // Reset button text
      const button = document.getElementById(action === 'processSchemas' ? 'processSchemas' : 'rankSchemas');
      if (button) {
          button.textContent = action === 'processSchemas' ? 'Process Schemas' : 'Rank Schemas';
      }
      // Show error to user
      alert(`Error: ${error.message}`);
  }
}