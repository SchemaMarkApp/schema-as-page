window.addEventListener('error', (event) => {
  console.error('View error:', event.error);
});
import { showLoading, showError, clearStatus } from './ui_utils.js';

let domReady = false;

function makeAccessible() {
  const elements = {
    'rawSchemas': 'Raw schema data section',
    'recommendations': 'Schema recommendations section',
    'schemaBoxes': 'Schema information boxes'
  };
  
  for (const [id, label] of Object.entries(elements)) {
    const element = document.getElementById(id);
    if (element) {
      element.setAttribute('role', 'region');
      element.setAttribute('aria-label', label);
    }
  }
}
function init() {
  console.log('Initializing...');
  makeAccessible();
}
function displaySchemaInfo(data) {
  console.log('Displaying schema info:', data);
  document.getElementById('websiteName').innerHTML = `<h1>${data.websiteName || data.pageTitle || 'Website Name Not Found'}</h1>`;
  document.getElementById('descriptionBlock').innerHTML = `<p>${data.webPageDescription || data.pageDescription || 'Description not found'}</p>`;
  
  const schemaBoxesElem = document.getElementById('schemaBoxes');
  schemaBoxesElem.innerHTML = '';
  if (data.schemaObjects && data.schemaObjects.length > 0) {
    data.schemaObjects.forEach((schema, index) => {
      const schemaBox = document.createElement('div');
      schemaBox.className = 'schema-box';
      schemaBox.innerHTML = `
        <h2>Schema ${index + 1}</h2>
        <pre>${JSON.stringify(schema, null, 2)}</pre>
      `;
      schemaBoxesElem.appendChild(schemaBox);
    });
  } else {
    schemaBoxesElem.innerHTML = '<p>No schemas found</p>';
  }

  // Display navigation menus
  document.getElementById('headerNavigation').innerHTML = createNavigationMenu(data.headerMenuItems || [], 'Header Navigation');
  document.getElementById('footerNavigation').innerHTML = createNavigationMenu(data.footerMenuItems || [], 'Footer Navigation');
}

function getOriginalTabUrl() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getOriginalTabUrl' }, (response) => {
      resolve(response.url);
    });
  });
}

function isEmptySchema(obj) {
  const keys = Object.keys(obj);
  return keys.length <= 2 && keys.every(key => key === '@type' || key === '@id');
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

async function checkUrlStatus(url) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'checkUrlStatus', url: url }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        resolve('Error');
      } else if (!response) {
        console.error('No response received');
        resolve('Error');
      } else {
        console.log('Status received:', response.status);
        resolve(response.status.toString());
      }
    });
  });
}

function processSchemas(schemas) {
  let processedData = {
    websiteName: '',
    webPageDescription: '',
    headerMenuItems: [],
    footerMenuItems: [],
    schemaObjects: []
  };

  schemas.forEach(schema => {
    traverseSchema(schema, processedData);
  });

  return processedData;
}

function traverseSchema(obj, data, parentType = null) {
  if (typeof obj !== 'object' || obj === null) return;

  if (Array.isArray(obj)) {
    obj.forEach(item => traverseSchema(item, data, parentType));
    return;
  }

  if (obj['@type'] && !isEmptySchema(obj)) {
    if (obj['@type'] === 'WebSite') {
      data.websiteName = obj.name || data.websiteName;
    } else if (obj['@type'] === 'WebPage') {
      data.webPageDescription = obj.description || data.webPageDescription;
    } else if (obj['@type'] === 'SiteNavigationElement' || (Array.isArray(obj['@type']) && obj['@type'].includes('SiteNavigationElement'))) {
      if (obj.name && obj.url) {
        if (Array.isArray(obj['@type']) && obj['@type'].includes('WPFooter')) {
          data.footerMenuItems.push({ name: obj.name, url: obj.url });
        } else {
          data.headerMenuItems.push({ name: obj.name, url: obj.url });
        }
      }
    } else if (obj['@type'] !== 'WebPageElement') {
      // Skip WebPageElement as it contains redundant navigation information
      data.schemaObjects.push(obj);
    }
    parentType = obj['@type'];
  }

  for (let key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null && !isEmptySchema(obj[key])) {
      traverseSchema(obj[key], data, parentType);
    }
  }
}

function createNavigationMenu(menuItems, title) {
  if (!menuItems || menuItems.length === 0) {
    return `<h2>${title}</h2><p>No menu items found</p>`;
  }

  const menuHtml = menuItems.map(item => `<li><a href="${item.url}" target="_blank">${item.name}</a></li>`).join('');
  return `
    <h2>${title}</h2>
    <ul class="menu-list">
      ${menuHtml}
    </ul>
  `;
}

async function createSchemaBox(schemaObj, isNested = false) {
  const box = document.createElement('div');
  box.className = 'schema-box' + (isNested ? ' nested-schema-box' : '');
  
  if (schemaObj['@type']) {
    const typeString = Array.isArray(schemaObj['@type']) ? schemaObj['@type'].join(', ') : schemaObj['@type'];
    box.innerHTML = `<h2>${typeString}</h2>`;
  }

  const content = document.createElement('dl');

  for (let key in schemaObj) {
    if (key !== '@type' && key !== '@context' && key !== '@id') {
      const dt = document.createElement('dt');
      dt.textContent = key.charAt(0).toUpperCase() + key.slice(1);
      content.appendChild(dt);

      const dd = document.createElement('dd');
      
      if (typeof schemaObj[key] === 'object' && schemaObj[key] !== null) {
        if (schemaObj[key]['@type'] === 'ImageObject' || key === 'image') {
          const imageObj = schemaObj[key];
          const imageUrl = imageObj.url || imageObj.contentUrl || (typeof imageObj === 'string' ? imageObj : null);
          
          if (imageUrl && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(imageUrl)) {
            dd.innerHTML = `<img src="${imageUrl}" alt="${imageObj.caption || key}" style="max-width: 200px; max-height: 200px;"><br>`;
            if (imageObj.width) dd.innerHTML += `Width: ${imageObj.width}px<br>`;
            if (imageObj.height) dd.innerHTML += `Height: ${imageObj.height}px<br>`;
            if (imageObj.caption) dd.innerHTML += `Caption: ${imageObj.caption}<br>`;
            if (imageObj.inLanguage) dd.innerHTML += `Language: ${imageObj.inLanguage}`;
          } else {
            for (let imgKey in imageObj) {
              if (imgKey !== '@type') {
                dd.innerHTML += `${imgKey}: ${imageObj[imgKey]}<br>`;
              }
            }
          }
        } else {
          dd.appendChild(await createSchemaBox(schemaObj[key], true));
        }
      } else if (Array.isArray(schemaObj[key])) {
        dd.innerHTML = await Promise.all(schemaObj[key].map(async (item, index) => {
          if (typeof item === 'string' && isValidUrl(item)) {
            console.log('Checking URL in array:', item);
            try {
              const status = await checkUrlStatus(item);
              console.log('Received status for array item:', status);
              const statusClass = status.startsWith('2') ? 'success' : 
                                  status.startsWith('3') ? 'warning' : 'error';
              return `${index + 1}. <a href="${item}" target="_blank">${item}</a> <span class="status-code ${statusClass}">${status}</span><br>`;
            } catch (error) {
              console.error('Error checking URL status:', error);
              return `${index + 1}. <a href="${item}" target="_blank">${item}</a> <span class="status-code error">Error</span><br>`;
            }
          } else {
            return `${index + 1}. ${item}<br>`;
          }
        })).then(results => results.join(''));
      } else if (typeof schemaObj[key] === 'string') {
        if (isValidUrl(schemaObj[key])) {
          console.log('Checking URL:', schemaObj[key]);
          try {
            const status = await checkUrlStatus(schemaObj[key]);
            console.log('Received status:', status);
            const statusClass = status.startsWith('2') ? 'success' : 
                                status.startsWith('3') ? 'warning' : 'error';
            dd.innerHTML = `<a href="${schemaObj[key]}" target="_blank">${schemaObj[key]}</a> <span class="status-code ${statusClass}">${status}</span>`;
          } catch (error) {
            console.error('Error checking URL status:', error);
            dd.innerHTML = `<a href="${schemaObj[key]}" target="_blank">${schemaObj[key]}</a> <span class="status-code error">Error</span>`;
          }
        } else if (/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(schemaObj[key])) {
          dd.innerHTML = `<img src="${schemaObj[key]}" alt="${key}" style="max-width: 200px; max-height: 200px;">`;
        } else {
          dd.textContent = schemaObj[key];
        }
      } else {
        dd.textContent = schemaObj[key];
      }
      
      content.appendChild(dd);
    }
  }

  box.appendChild(content);
  return box;
}

function createSplitView(originalTabId) {
  console.log('Creating split view');
  
  chrome.tabs.sendMessage(originalTabId, { action: 'getPageContent' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error getting page content:', chrome.runtime.lastError);
      return;
    }
    
    if (!response || !response.content) {
      console.error('Invalid response from content script');
      return;
    }
    
    const iframe = document.createElement('iframe');
    iframe.srcdoc = response.content;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    
    const rightDiv = document.getElementById('right');
    rightDiv.innerHTML = ''; // Clear any existing content
    rightDiv.appendChild(iframe);
    
    console.log('Split view created');
  });
}

function initializeExtension() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Split view received message:', request);
  
    if (request.action === 'processSchemas') {
      console.log('Processing schemas in split view:', request.data);
      if (domReady) {
        const processedData = processSchemas(request.data.schemas);
        displaySchemaInfo({
          ...request.data,
          ...processedData
        });
        createSplitView(request.data.originalTabId); // Add this line
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          const processedData = processSchemas(request.data.schemas);
          displaySchemaInfo({
            ...request.data,
            ...processedData
          });
          createSplitView(request.data.originalTabId); // Add this line
        });
      }
      sendResponse({success: true});
    }
    return true; // Indicates we will send a response asynchronously
  });
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded in split_view.js');
  domReady = true;
  init();
  initializeExtension();

  // Add event listener for image load errors
  document.body.addEventListener('error', function(e) {
    if (e.target.tagName.toLowerCase() === 'img') {
      console.error('Image failed to load:', e.target.src);
      const errorText = document.createElement('span');
      errorText.textContent = `Failed to load image: ${e.target.src}`;
      errorText.style.color = 'red';
      e.target.parentNode.insertBefore(errorText, e.target.nextSibling);
    }
  }, true);

  // Ensure that DOM elements exist before trying to manipulate them
  const requiredElements = ['websiteName', 'headerNavigation', 'descriptionBlock', 'schemaBoxes', 'footerNavigation', 'right'];
  const missingElements = requiredElements.filter(id => !document.getElementById(id));

  if (missingElements.length > 0) {
    console.error('One or more required DOM elements are missing:', missingElements);
    return;
  }

  console.log('All required DOM elements are present');
});