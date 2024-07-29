document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('visualizeButton').addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.id) {
          chrome.tabs.sendMessage(activeTab.id, { action: 'extractSchema' }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error:', chrome.runtime.lastError.message || chrome.runtime.lastError);
            } else if (response && response.schema) {
              chrome.storage.local.set({
                jsonSchemas: response.schema,
                currentUrl: activeTab.url
              }, () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('split_view.html') });
              });
            } else {
              console.error('No schema found.');
            }
          });
        }
      });
    });
  });