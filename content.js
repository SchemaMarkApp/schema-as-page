console.log('Content script loaded.');
   chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
       console.log('Message received:', request);
       if (request.action === 'extractSchema') {
           const schemas = [];
           document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
               try {
                   const json = JSON.parse(script.innerText);
                   schemas.push(json);
               } catch (e) {
                   console.error('Error parsing JSON:', e);
               }
           });
           sendResponse({ schema: schemas });
       }
   });