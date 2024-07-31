document.getElementById('extractSchema').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {action: 'extractSchema'}, (response) => {
      const processedData = processSchemas(response.schemas);
      const schemaHTML = generateHTML(processedData);
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'createSplitView',
        originalContent: tabs[0].url,
        schemaHTML: schemaHTML
      });
    });
  });
});