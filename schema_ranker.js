import { showLoading, showError, clearStatus, debounce } from './ui_utils.js';
function addControlPanel() {
  const controlPanel = document.createElement('div');
  controlPanel.className = 'control-panel';
  controlPanel.innerHTML = `
      <div class="controls">
          <button id="gridViewBtn">Grid View</button>
          <button id="stackViewBtn">Stack View</button>
          <button id="expandAllBtn">Expand All</button>
          <button id="collapseAllBtn">Collapse All</button>
          <select id="schemaFilter">
              <option value="all">All Schemas</option>
              <option value="organization">Organization</option>
              <option value="webpage">WebPage</option>
              <option value="website">WebSite</option>
          </select>
      </div>
  `;
  document.body.insertBefore(controlPanel, document.getElementById('content'));

  // Add event listeners
  document.getElementById('gridViewBtn').addEventListener('click', () => toggleView('grid'));
  document.getElementById('stackViewBtn').addEventListener('click', () => toggleView('stack'));
  document.getElementById('expandAllBtn').addEventListener('click', expandAll);
  document.getElementById('collapseAllBtn').addEventListener('click', collapseAll);
  document.getElementById('schemaFilter').addEventListener('change', handleSchemaFilter);
}

function toggleView(type) {
  const content = document.getElementById('content');
  content.className = type === 'grid' ? 'grid-view' : 'stack-view';
}

function expandAll() {
  document.querySelectorAll('.schema-box pre').forEach(pre => {
      pre.style.maxHeight = 'none';
  });
}

function collapseAll() {
  document.querySelectorAll('.schema-box pre').forEach(pre => {
      pre.style.maxHeight = '200px';
  });
}

function handleSchemaFilter(e) {
  const value = e.target.value;
  const schemaBoxes = document.querySelectorAll('.schema-box');
  
  schemaBoxes.forEach(box => {
      if (value === 'all') {
          box.style.display = 'block';
      } else {
          const schemaContent = box.textContent.toLowerCase();
          box.style.display = schemaContent.includes(value) ? 'block' : 'none';
      }
  });
}

let domReady = false;

// Create the debounced function outside of processSchemas
const processSchemaDebounced = debounce(processSchemas, 250);

// Schema ranking configuration
const schemaRanks = {
  'Organization': 5,
  'Person': 4,
  'WebSite': 3,
  'WebPage': 2,
  'Article': 4,
  'Product': 5,
  'LocalBusiness': 5,
  'Event': 4,
  'Recipe': 3,
  'Review': 3,
  'FAQPage': 4,
  'HowTo': 4,
  'JobPosting': 3,
  'Course': 3,
  'CreativeWork': 2,
  'BreadcrumbList': 1,
  'ItemList': 1,
};

const schemaTypes = new Set([
  'WebPage', 'WebSite', 'Organization', 'Person', 'BreadcrumbList', 'ListItem',
  'ReadAction', 'SearchAction', 'EntryPoint'
]);

const processedIds = new Set();

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

function displayRawSchemas(schemas) {
  const rawSchemasElem = document.getElementById('rawSchemas');
  if (!rawSchemasElem) {
    throw new Error('Raw schemas element not found');
  }

  rawSchemasElem.innerHTML = '';
  
  if (schemas && schemas.length > 0) {
    schemas.forEach((schema, index) => {
      const schemaBox = document.createElement('div');
      schemaBox.className = 'schema-box';
      schemaBox.innerHTML = `
        <h3>Schema ${index + 1}</h3>
        <pre>${JSON.stringify(schema, null, 2)}</pre>
      `;
      rawSchemasElem.appendChild(schemaBox);
    });
  } else {
    rawSchemasElem.innerHTML = '<p>No schemas found</p>';
  }
}

function rankSchemas(schemas) {
  return schemas.map(schema => {
    const type = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
    return {
      type: type,
      rank: schemaRanks[type] || 0,
      schema: schema
    };
  }).sort((a, b) => b.rank - a.rank);
}

function findSchemaType(schemas, type) {
  for (const schema of schemas) {
    if (schema['@type'] === type) {
      return schema;
    }
    if (schema['@graph']) {
      if (Array.isArray(schema['@graph'])) {
        const found = schema['@graph'].find(item => item['@type'] === type);
        if (found) return found;
      } else if (schema['@graph']['@type'] === type) {
        return schema['@graph'];
      }
    }
  }
  return null;
}

function isSchemaType(key) {
  return schemaTypes.has(key);
}

function shouldHaveId(obj) {
  return obj['@type'] !== undefined;
}

function checkSchemaIds(schema, schemaType, recommendations, path = '') {
  if (shouldHaveId(schema)) {
    const types = Array.isArray(schema['@type']) ? schema['@type'] : [schema['@type']];
    const uniqueId = `${path}:${types.join('|')}`;

    if (schema['@id']) {
      if (!schema['@id'].startsWith('schema:') && !processedIds.has(schema['@id'])) {
        recommendations.push({
          type: `Incorrect @id format: ${types.join('/')}`,
          message: `The @id for ${types.join('/')} at ${path} should start with "schema:". Current value: "${schema['@id']}"`,
          example: types.map(type => `"@id": "schema:${type}"`).join(' or ')
        });
        processedIds.add(schema['@id']);
      }
    } else if (!processedIds.has(uniqueId)) {
      recommendations.push({
        type: `Missing @id: ${types.join('/')}`,
        message: `Add an @id property to the ${types.join('/')} schema at ${path}.`,
        example: types.map(type => `"@id": "schema:${type}"`).join(' or ')
      });
      processedIds.add(uniqueId);
    }
  }

  // Check nested objects
  for (const key in schema) {
    if (typeof schema[key] === 'object' && schema[key] !== null) {
      const newPath = path ? `${path}.${key}` : key;
      if (Array.isArray(schema[key])) {
        schema[key].forEach((item, index) => {
          checkSchemaIds(item, item['@type'] || `${key}[${index}]`, recommendations, `${newPath}[${index}]`);
        });
      } else {
        checkSchemaIds(schema[key], schema[key]['@type'] || key, recommendations, newPath);
      }
    }
  }
}

async function generateRecommendations(rankedSchemas, pageTitle, pageDescription, homepageTitle) {
  const recommendations = [];
  processedIds.clear();
  
  try {
    const url = new URL(window.location.href);
    const websiteUrl = `${url.protocol}//${url.hostname}`;

    // Find WebSite schema
    const webSiteSchema = findSchemaType(rankedSchemas.map(s => s.schema), 'WebSite');
    const websiteName = webSiteSchema?.name || homepageTitle || url.hostname;
    const websiteId = 'schema:WebSite';

    // Get current date and time in ISO format
    const currentDate = new Date().toISOString();

    // Find existing WebPage schema
    const existingWebPageSchema = findSchemaType(rankedSchemas.map(s => s.schema), 'WebPage');

    // Check for WebPage schema
    if (!existingWebPageSchema) {
      recommendations.push({
        type: 'Missing Schema: WebPage',
        message: 'Add WebPage schema to improve page indexing and search appearance.',
        example: `{
  "@type": "WebPage",
  "@id": "schema:WebPage",
  "url": "${window.location.href}",
  "name": "${pageTitle}",
  "description": "${pageDescription || 'Add a description of the page here'}",
  "datePublished": "${currentDate}",
  "dateModified": "${currentDate}",
  "isPartOf": {
    "@type": "WebSite",
    "@id": "${websiteId}",
    "url": "${websiteUrl}",
    "name": "${websiteName}"
  }
}`
      });
    } else {
      // Check for missing properties
      const missingProperties = [];
      const requiredProps = ['url', 'name', 'description', 'datePublished', 'dateModified', 'isPartOf'];
      
      for (const prop of requiredProps) {
        if (!existingWebPageSchema[prop]) {
          missingProperties.push(prop);
        }
      }

      if (missingProperties.length > 0) {
        recommendations.push({
          type: 'Incomplete Schema: WebPage',
          message: `The WebPage schema is missing the following properties: ${missingProperties.join(', ')}`,
          example: `{
  "@type": "WebPage",
  "@id": "schema:WebPage",
  "url": "${existingWebPageSchema.url || window.location.href}",
  "name": "${existingWebPageSchema.name || pageTitle}",
  "description": "${existingWebPageSchema.description || pageDescription || 'Add a description of the page here'}",
  "datePublished": "${existingWebPageSchema.datePublished || currentDate}",
  "dateModified": "${existingWebPageSchema.dateModified || currentDate}",
  "isPartOf": {
    "@type": "WebSite",
    "@id": "${websiteId}",
    "url": "${websiteUrl}",
    "name": "${websiteName}"
  }
}`
        });
      }

      // Check @id format and nested schemas
      checkSchemaIds(existingWebPageSchema, 'WebPage', recommendations);
    }

    // Check other schemas
    rankedSchemas.forEach(rankedSchema => {
      const schema = rankedSchema.schema;
      if (schema['@graph'] && Array.isArray(schema['@graph'])) {
        schema['@graph'].forEach((item, index) => {
          checkSchemaIds(item, item['@type'] || `Graph[${index}]`, recommendations, `@graph[${index}]`);
        });
      } else if (schema['@graph']) {
        checkSchemaIds(schema['@graph'], schema['@graph']['@type'] || 'Graph', recommendations, '@graph');
      } else {
        checkSchemaIds(schema, schema['@type'] || 'Unknown', recommendations);
      }
    });

  } catch (error) {
    console.error('Error generating recommendations:', error);
    recommendations.push({
      type: 'Error',
      message: `Error analyzing schemas: ${error.message}`,
      example: 'Please check the console for more details.'
    });
  }

  return recommendations;
}

function displayRecommendations(recommendations) {
  const recommendationsElem = document.getElementById('recommendations');
  if (!recommendationsElem) {
    throw new Error('Recommendations element not found');
  }

  recommendationsElem.innerHTML = '';

  if (recommendations.length === 0) {
    recommendationsElem.innerHTML = '<p>No recommendations at this time.</p>';
    return;
  }

  recommendations.forEach(rec => {
    const recBox = document.createElement('div');
    recBox.className = 'recommendation-box';
    recBox.innerHTML = `
      <h3>${rec.type}</h3>
      <p>${rec.message}</p>
      <pre>${rec.example}</pre>
    `;
    recommendationsElem.appendChild(recBox);
  });
}

function init() {
  console.log('Initializing...');
  makeAccessible();
  addControlPanel(); // Add this line
}

function initializeExtension() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Schema ranker received message:', request);
    
    if (request.action === 'checkInit') {
      sendResponse({ initialized: true });
      return true;
    } 
    
    if (request.action === 'rankSchemas') {
      console.log('Ranking schemas:', request.data);
      if (domReady) {
        processSchemaDebounced(
          request.data.schemas, 
          request.data.pageTitle, 
          request.data.pageDescription, 
          request.data.homepageTitle
        );
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          processSchemaDebounced(
            request.data.schemas, 
            request.data.pageTitle, 
            request.data.pageDescription, 
            request.data.homepageTitle
          );
        });
      }
      sendResponse({ received: true });
      return true;
    }
    
    return false;
  });
}

async function processSchemas(schemas, pageTitle, pageDescription, homepageTitle) {
  showLoading('rawSchemas');
  try {
    displayRawSchemas(schemas);
    const rankedSchemas = rankSchemas(schemas);
    const recommendations = await generateRecommendations(
      rankedSchemas, 
      pageTitle, 
      pageDescription, 
      homepageTitle
    );
    displayRecommendations(recommendations);
    clearStatus('rawSchemas');
  } catch (error) {
    console.error('Error processing schemas:', error);
    showError('rawSchemas', error.message);
  }
}

window.addEventListener('error', (event) => {
  console.error('View error:', event.error);
  showError('rawSchemas', event.error.message);
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('Schema ranker DOM loaded');
  domReady = true;
  init();
  initializeExtension();

  const rawSchemasElem = document.getElementById('rawSchemas');
  const recommendationsElem = document.getElementById('recommendations');

  if (!rawSchemasElem || !recommendationsElem) {
    console.error('One or more required DOM elements are missing');
    return;
  }

  console.log('All required DOM elements are present');
});