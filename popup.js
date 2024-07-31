document.getElementById('extractSchema').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const originalTabId = tabs[0].id;
    chrome.tabs.sendMessage(originalTabId, {action: 'extractSchema'}, (response) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }
      
      chrome.tabs.create({
        url: chrome.runtime.getURL('split_view.html'),
        active: true
      }, (tab) => {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            
            chrome.tabs.sendMessage(tab.id, {
              action: 'processSchemas',
              schemas: response.schemas,
              originalTabId: originalTabId
            });
          }
        });
      });
    });
  });
});