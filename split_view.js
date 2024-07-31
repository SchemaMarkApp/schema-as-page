function isEmptySchema(obj) {
  const keys = Object.keys(obj);
  return keys.length <= 2 && keys.every(key => key === '@type' || key === '@id');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processSchemas') {
    console.log('Received schemas:', request.schemas);
    const processedData = processSchemas(request.schemas);
    console.log('Processed data:', processedData);
    displaySchemaInfo(processedData);
    createSplitView(request.originalTabId);
  }
});

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

function displaySchemaInfo(processedData) {
  const websiteNameElem = document.getElementById('websiteName');
  websiteNameElem.innerHTML = `<h1>${processedData.websiteName || 'Website Name Not Found'}</h1>`;

  const headerNavigationElem = document.getElementById('headerNavigation');
  if (processedData.headerMenuItems && processedData.headerMenuItems.length > 0) {
    headerNavigationElem.innerHTML = '<ul>' + 
      processedData.headerMenuItems.map(item => `<li><a href="${item.url}">${item.name}</a></li>`).join('') + 
      '</ul>';
  } else {
    headerNavigationElem.innerHTML = '';
  }

  const descriptionBlockElem = document.getElementById('descriptionBlock');
  descriptionBlockElem.innerHTML = `<h2>Page Description</h2><p>${processedData.webPageDescription || 'Description not found'}</p>`;

  const schemaBoxesElem = document.getElementById('schemaBoxes');
  schemaBoxesElem.innerHTML = '';
  processedData.schemaObjects.forEach(schemaObj => {
    schemaBoxesElem.appendChild(createSchemaBox(schemaObj));
  });

  const footerNavigationElem = document.getElementById('footerNavigation');
  if (processedData.footerMenuItems && processedData.footerMenuItems.length > 0) {
    footerNavigationElem.innerHTML = '<ul>' + 
      processedData.footerMenuItems.map(item => `<li><a href="${item.url}">${item.name}</a></li>`).join('') + 
      '</ul>';
  } else {
    footerNavigationElem.innerHTML = '';
  }
}

function createSchemaBox(schemaObj) {
  const box = document.createElement('div');
  box.className = 'schema-box';
  box.innerHTML = `<h2>${schemaObj['@type']}</h2>`;

  const content = document.createElement('dl');

  for (let key in schemaObj) {
    if (key !== '@type' && key !== '@context' && key !== '@id') {
      const dt = document.createElement('dt');
      dt.textContent = key;
      content.appendChild(dt);

      const dd = document.createElement('dd');
      if (key === 'image' || key === 'logo' || schemaObj['@type'] === 'ImageObject') {
        const imageUrl = typeof schemaObj[key] === 'object' ? schemaObj[key].url : schemaObj[key];
        if (imageUrl) {
          dd.innerHTML = `<img src="${imageUrl}" alt="${key}" style="max-width: 200px; max-height: 200px;">`;
        } else if (schemaObj['@type'] === 'ImageObject' && schemaObj.url) {
          dd.innerHTML = `<img src="${schemaObj.url}" alt="Image" style="max-width: 200px; max-height: 200px;">`;
        }
      } else if (key === 'sameAs' && Array.isArray(schemaObj[key])) {
        dd.innerHTML = schemaObj[key].map(url => `<a href="${url}" target="_blank">${url}</a>`).join('<br>');
      } else if (typeof schemaObj[key] === 'object' && !isEmptySchema(schemaObj[key])) {
        dd.appendChild(createSchemaBox(schemaObj[key]));
      } else if (typeof schemaObj[key] !== 'object') {
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
      console.error(chrome.runtime.lastError);
      return;
    }
    
    const iframe = document.createElement('iframe');
    iframe.srcdoc = response.content;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    document.getElementById('right').appendChild(iframe);
    console.log('Split view created');
  });
}