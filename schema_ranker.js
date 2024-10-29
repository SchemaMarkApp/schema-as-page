import { showLoading, showError as showUIError, clearStatus, debounce } from './ui_utils.js';

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

  // Add event listeners using the proper selector method
  document.getElementById('gridViewBtn').addEventListener('click', () => toggleView('grid'));
  document.getElementById('stackViewBtn').addEventListener('click', () => toggleView('stack'));
  document.getElementById('expandAllBtn').addEventListener('click', expandAll);
  document.getElementById('collapseAllBtn').addEventListener('click', collapseAll);
  document.getElementById('schemaFilter').addEventListener('change', handleSchemaFilter);
}

function toggleView(type) {
  const content = document.getElementById('content');
  const gridBtn = document.getElementById('gridViewBtn');
  const stackBtn = document.getElementById('stackViewBtn');
  
  content.className = type === 'grid' ? 'grid-view' : 'stack-view';
  
  // Update button states
  gridBtn.classList.toggle('active', type === 'grid');
  stackBtn.classList.toggle('active', type === 'stack');
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
  const value = e.target.value.toLowerCase();
  const schemaBoxes = Array.from(document.querySelectorAll('.schema-box'));
  
  schemaBoxes.forEach(box => {
    if (value === 'all') {
      box.style.display = 'block';
      box.classList.remove('highlighted');
    } else {
      const schemaContent = box.textContent.toLowerCase();
      const matches = schemaContent.includes(value);
      box.style.display = matches ? 'block' : 'none';
      box.classList.toggle('highlighted', matches);
    }
  });

  // Sort matching schemas to top
  if (value !== 'all') {
    const container = document.getElementById('rawSchemas');
    schemaBoxes
      .filter(box => box.style.display !== 'none')
      .forEach(box => container.appendChild(box));
  }
}
let domReady = false;
const schemaLocationRecommendations = {
  'Organization': {
    suggestedPage: 'About page',
    reason: 'Organization schema is best placed on your About or main company information page to establish your organizational identity.',
    urlPattern: '/about',
    example: `{
  "@type": "Organization",
  "@id": "schema:Organization",
  "name": "Your Company Name",
  "url": "https://www.example.com",
  "logo": "https://www.example.com/logo.png",
  "description": "About your company",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Business Street",
    "addressLocality": "City",
    "addressRegion": "State",
    "postalCode": "12345",
    "addressCountry": "Country"
  }
}`
  },
  'ContactPage': {
    suggestedPage: 'Contact page',
    reason: 'ContactPage schema should be implemented on your dedicated contact page to help search engines understand where users can reach you.',
    urlPattern: '/contact',
    example: `{
  "@type": "ContactPage",
  "@id": "schema:ContactPage",
  "name": "Contact Us",
  "url": "https://www.example.com/contact",
  "description": "Get in touch with our team",
  "mainEntity": {
    "@type": "Organization",
    "name": "Your Company Name",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-234-567-8900",
      "contactType": "customer service",
      "email": "contact@example.com",
      "availableLanguage": "English"
    }
  }
}`
  },
  'ContactPoint': {
    suggestedPage: 'Contact page',
    reason: 'ContactPoint schema is most effective when placed on your contact page, helping users find your contact information through search results.',
    urlPattern: '/contact',
    example: `{
  "@type": "ContactPoint",
  "@id": "schema:ContactPoint",
  "telephone": "+1-234-567-8900",
  "contactType": "customer service",
  "email": "contact@example.com",
  "availableLanguage": "English",
  "areaServed": "Worldwide",
  "hoursAvailable": "Mo-Fr 09:00-17:00"
}`
  }
};
function schemaError(elementId, message) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  // Create error element
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  
  // Add error content
  errorDiv.innerHTML = `
      <h3>Error</h3>
      <p>${message}</p>
      <button id="retryButton">Retry</button>
  `;
  
  // Clear and add new content
  element.innerHTML = '';
  element.appendChild(errorDiv);
  
  // Add event listener to retry button
  document.getElementById('retryButton').addEventListener('click', () => {
      window.location.reload();
  });
}
// Add this function to check if current URL matches suggested pattern
function isOnRecommendedPage(schemaType, currentUrl) {
  const recommendation = schemaLocationRecommendations[schemaType];
  if (!recommendation) return true; // No recommendation for this type
  
  try {
    const url = new URL(currentUrl);
    return url.pathname.toLowerCase().includes(recommendation.urlPattern);
  } catch (e) {
    console.error('Error parsing URL:', e);
    return false;
  }
}
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
      
      // Get schema type(s)
      let schemaType = schema['@type'];
      if (Array.isArray(schemaType)) {
        schemaType = schemaType.join(', ');
      }
      
      // Create a more descriptive title
      const title = schemaType 
        ? `Schema ${index + 1} - "${schemaType}"`
        : schema.name 
          ? `Schema ${index + 1} - "${schema.name}"`
          : `Schema ${index + 1}`;

      schemaBox.innerHTML = `
        <h3 class="schema-title">${title}</h3>
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
function isHomePage(url) {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname;
    // Trim trailing slash for comparison
    const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
    
    // Debug log
    console.log('Checking if homepage:', {
      url: url,
      path: path,
      cleanPath: cleanPath,
      isHome: cleanPath === '' || 
              cleanPath.toLowerCase() === '/index.html' ||
              cleanPath.toLowerCase() === '/index.php'
    });
    
    return cleanPath === '' || 
           cleanPath.toLowerCase() === '/index.html' ||
           cleanPath.toLowerCase() === '/index.php';
  } catch (e) {
    console.error('Error parsing URL:', e);
    return false;
  }
}

function findBreadcrumbInSchema(schema) {
  // Direct check
  if (schema['@type'] === 'BreadcrumbList') {
    return true;
  }
  
  // Check in breadcrumb property
  if (schema.breadcrumb) {
    if (Array.isArray(schema.breadcrumb)) {
      return schema.breadcrumb.some(item => item['@type'] === 'BreadcrumbList');
    }
    return schema.breadcrumb['@type'] === 'BreadcrumbList';
  }
  
  // Check nested objects
  if (typeof schema === 'object' && schema !== null) {
    for (const key in schema) {
      if (typeof schema[key] === 'object' && schema[key] !== null) {
        if (findBreadcrumbInSchema(schema[key])) {
          return true;
        }
      }
    }
  }
  
  return false;
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

async function generateRecommendations(rankedSchemas, pageTitle, pageDescription, homepageTitle, originalUrl) {
  const recommendations = [];
  processedIds.clear();
  
  try {
    // Ensure we have a valid URL
    if (!originalUrl) {
      throw new Error('No valid URL provided');
    }
    
    const url = new URL(originalUrl);
    // Skip chrome-extension URLs
    if (url.protocol === 'chrome-extension:') {
      throw new Error('Invalid URL protocol');
    }
    
    const websiteUrl = `${url.protocol}//${url.hostname}`;
      
    // Find WebSite schema
    const webSiteSchema = findSchemaType(rankedSchemas.map(s => s.schema), 'WebSite');
    const websiteName = webSiteSchema?.name || homepageTitle || url.hostname;
    const websiteId = 'schema:WebSite';

    // Get current date and time in ISO format
    const currentDate = new Date().toISOString();

    const pathSegments = url.pathname.split('/')
    .filter(segment => segment)
    .map(segment => ({
      name: segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      path: segment
    }));
    const breadcrumbExample = `{
      "@type": "BreadcrumbList",
      "name": "BreadcrumbList",
      "@id": "schema:BreadcrumbList",
      "numberOfItems": ${pathSegments.length + 1},
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "@id": "schema:ListItem",
          "name": "Home",
          "item": "${websiteUrl}/"
        },
        ${pathSegments.map((segment, index) => {
          const itemPath = pathSegments
            .slice(0, index + 1)
            .map(s => s.path)
            .join('/');
          return `{
            "@type": "ListItem",
            "position": ${index + 2},
            "@id": "schema:ListItem",
            "name": "${segment.name}",
            "item": "${websiteUrl}/${itemPath}/"
          }`
        }).join(',\n      ')}
      ]
    }`;
    // Find existing WebPage schema
    const existingWebPageSchema = findSchemaType(rankedSchemas.map(s => s.schema), 'WebPage');
    const hasBreadcrumb = rankedSchemas.some(rs => findBreadcrumbInSchema(rs.schema));

// Check for WebPage schema
if (!existingWebPageSchema) {
  recommendations.push({
    type: 'Missing Schema: WebPage',
    message: 'Add WebPage schema to improve page indexing and search appearance.',
    example: `{
  "@type": "WebPage",
  "@id": "schema:WebPage",
  "url": "${url.href}",
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
}

// Check for breadcrumbs only if not homepage
if (!isHomePage(url.href)) {
  console.log('Not homepage, checking breadcrumbs');
  const hasBreadcrumb = rankedSchemas.some(rs => findBreadcrumbInSchema(rs.schema));
  console.log('Has breadcrumb:', hasBreadcrumb);
  console.log('Path segments:', pathSegments);

  if (!hasBreadcrumb && pathSegments.length > 0) {
    // First, show the breadcrumb recommendation
    recommendations.push({
      type: 'Missing BreadcrumbList',
      message: 'Add BreadcrumbList to help search engines understand the page hierarchy.',
      example: breadcrumbExample,
      priority: 'high'
    });
  } else {
    // Check existing breadcrumb format in all schemas
    const breadcrumbSchemas = [];
    rankedSchemas.forEach(rs => {
      if (rs.schema['@type'] === 'BreadcrumbList') {
        breadcrumbSchemas.push(rs.schema);
      } else if (rs.schema.breadcrumb) {
        if (Array.isArray(rs.schema.breadcrumb)) {
          breadcrumbSchemas.push(...rs.schema.breadcrumb.filter(item => item['@type'] === 'BreadcrumbList'));
        } else if (rs.schema.breadcrumb['@type'] === 'BreadcrumbList') {
          breadcrumbSchemas.push(rs.schema.breadcrumb);
        }
      }
    });

    let hasIssues = false;
    breadcrumbSchemas.forEach(breadcrumb => {
      const issues = [];
      
      if (!breadcrumb['@id']) {
        issues.push('Missing @id property');
      }
      if (!breadcrumb.numberOfItems) {
        issues.push('Missing numberOfItems property');
      }
      if (!Array.isArray(breadcrumb.itemListElement)) {
        issues.push('itemListElement should be an array');
      } else {
        breadcrumb.itemListElement.forEach((item, index) => {
          if (item.position !== index + 1) {
            issues.push(`Invalid position value at index ${index}`);
          }
          if (!item['@id']) {
            issues.push(`Missing @id for ListItem at position ${index + 1}`);
          }
          if (!item.item) {
            issues.push(`Missing item URL at position ${index + 1}`);
          }
        });
      }

      if (issues.length > 0) {
        hasIssues = true;
        recommendations.push({
          type: 'BreadcrumbList Format Issues',
          message: `Your BreadcrumbList schema has the following issues:\n${issues.map(issue => `• ${issue}`).join('\n')}`,
          example: breadcrumbExample,
          priority: 'medium'
        });
      }
    });

    // Add combined schema recommendation if there are issues
    if (hasIssues) {
      recommendations.push({
        type: 'Complete Combined Schema Example',
        message: 'Here is a complete example of WebPage schema with properly formatted BreadcrumbList:',
        example: `{
  "@type": "WebPage",
  "@id": "schema:WebPage",
  "url": "${url.href}",
  "name": "${pageTitle}",
  "description": "${pageDescription || 'Add a description of the page here'}",
  "datePublished": "${currentDate}",
  "dateModified": "${currentDate}",
  "isPartOf": {
    "@type": "WebSite",
    "@id": "${websiteId}",
    "url": "${websiteUrl}",
    "name": "${websiteName}"
  },
  "breadcrumb": [
    {
      "@type": "BreadcrumbList",
      "name": "BreadcrumbList",
      "@id": "schema:BreadcrumbList",
      "numberOfItems": ${pathSegments.length + 1},
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "@id": "schema:ListItem",
          "name": "Home",
          "item": "${websiteUrl}/"
        },
        ${pathSegments.map((segment, index) => {
          const itemPath = pathSegments
            .slice(0, index + 1)
            .map(s => s.path)
            .join('/');
          return `{
            "@type": "ListItem",
            "position": ${index + 2},
            "@id": "schema:ListItem",
            "name": "${segment.name}",
            "item": "${websiteUrl}/${itemPath}/"
          }`
        }).join(',\n          ')}
      ]
    }
  ]
}`,
        priority: 'medium'
      });
    }
  }
}

// Check other schemas
rankedSchemas.forEach(rankedSchema => {
  const schema = rankedSchema.schema;
  const schemaType = Array.isArray(schema['@type']) ? schema['@type'][0] : schema['@type'];
  
  // Check if this schema type has location recommendations
  if (schemaLocationRecommendations[schemaType]) {
    const recommendation = schemaLocationRecommendations[schemaType];
    
    // Check if schema is on the recommended page
    if (!isOnRecommendedPage(schemaType, url.href)) {
      recommendations.push({
        type: `Schema Location: ${schemaType}`,
        message: `This ${schemaType} schema would be more effective on your ${recommendation.suggestedPage}. ${recommendation.reason}`,
        example: recommendation.example,
        priority: 'high'
      });
    }
    
    // Add implementation recommendations for ContactPoint within Organization
    if (schemaType === 'Organization') {
      const hasContactPoint = schema.contactPoint || 
                          (schema.hasOwnProperty('contactPoint') && Array.isArray(schema.contactPoint));
      
      if (!hasContactPoint) {
        recommendations.push({
          type: 'Missing ContactPoint in Organization',
          message: 'Consider adding a ContactPoint to your Organization schema to help users find your contact information.',
          example: `{
  "@type": "Organization",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-234-567-8900",
    "contactType": "customer service",
    "email": "contact@example.com",
    "availableLanguage": "English"
  }
}`
        });
      }
    }
  }
});

// Sort recommendations by priority
recommendations.sort((a, b) => {
  if (a.priority === 'high' && b.priority !== 'high') return -1;
  if (b.priority === 'high' && a.priority !== 'high') return 1;
  return 0;
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
// Add these functions to schema_ranker.js

function createSearchBox() {
  const searchDiv = document.createElement('div');
  searchDiv.className = 'search-container';
  searchDiv.innerHTML = `
      <div class="search-box">
          <input type="text" id="schemaSearch" placeholder="Search in schemas...">
          <button id="clearSearch">×</button>
      </div>
      <div class="search-options">
          <label><input type="checkbox" id="caseSensitive"> Case sensitive</label>
          <label><input type="checkbox" id="wholeWord"> Whole word</label>
          <select id="searchTarget">
              <option value="both">Search everywhere</option>
              <option value="schemas">Schemas only</option>
              <option value="recommendations">Recommendations only</option>
          </select>
          <span id="searchResults"></span>
      </div>
  `;
  
  // Insert search box into control panel
  const controlPanel = document.querySelector('.controls');
  controlPanel.appendChild(searchDiv);

  // Add event listeners
  const searchInput = document.getElementById('schemaSearch');
  const clearButton = document.getElementById('clearSearch');
  const caseSensitive = document.getElementById('caseSensitive');
  const wholeWord = document.getElementById('wholeWord');
  const searchTarget = document.getElementById('searchTarget');

  let searchTimeout;

  searchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
          performSearch();
      }, 300);
  });

  clearButton.addEventListener('click', () => {
      searchInput.value = '';
      performSearch();
      searchInput.focus();
  });

  caseSensitive.addEventListener('change', performSearch);
  wholeWord.addEventListener('change', performSearch);
  searchTarget.addEventListener('change', performSearch);
}

function performSearch() {
  const searchInput = document.getElementById('schemaSearch');
  const searchTerm = searchInput.value;
  const caseSensitive = document.getElementById('caseSensitive').checked;
  const wholeWord = document.getElementById('wholeWord').checked;
  const searchTarget = document.getElementById('searchTarget').value;
  const resultSpan = document.getElementById('searchResults');
  const firstMatch = document.querySelector('.search-highlight');
  if (firstMatch) {
    firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Clear previous highlights
  clearHighlights();

  if (!searchTerm) {
      resultSpan.textContent = '';
      return;
  }

  let matchCount = 0;
  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

  // Function to test if a string matches the search criteria
  const matchesSearch = (text) => {
      const testText = caseSensitive ? text : text.toLowerCase();
      if (wholeWord) {
          const regex = new RegExp(`\\b${term}\\b`, caseSensitive ? 'g' : 'gi');
          return regex.test(testText);
      }
      return testText.includes(term);
  };

  // Function to highlight matches in an element
  const highlightMatches = (element, searchIn) => {
      const walker = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          null,
          false
      );

      let node;
      while (node = walker.nextNode()) {
          const text = node.textContent;
          if (matchesSearch(text)) {
              const regex = wholeWord ? 
                  new RegExp(`\\b${term}\\b`, caseSensitive ? 'g' : 'gi') :
                  new RegExp(term, caseSensitive ? 'g' : 'gi');
              
              const highlighted = text.replace(regex, match => `<mark class="search-highlight">${match}</mark>`);
              if (highlighted !== text) {
                  const span = document.createElement('span');
                  span.innerHTML = highlighted;
                  node.parentNode.replaceChild(span, node);
                  matchCount++;
              }
          }
      }
  };

  // Search in schemas
  if (searchTarget !== 'recommendations') {
    const schemaBoxes = Array.from(document.querySelectorAll('.schema-box'));
    schemaBoxes.sort((a, b) => {
      const aMatches = a.querySelectorAll('.search-highlight').length;
      const bMatches = b.querySelectorAll('.search-highlight').length;
      return bMatches - aMatches; // Sort descending (most matches first)
    });
    const container = document.getElementById('rawSchemas');
    schemaBoxes.forEach(box => container.appendChild(box));
  }

  // Search in recommendations
  if (searchTarget !== 'schemas') {
      const recommendationsDiv = document.getElementById('recommendations');
      highlightMatches(recommendationsDiv);
  }

  // Update result count
  resultSpan.textContent = matchCount ? 
      `${matchCount} match${matchCount === 1 ? '' : 'es'} found` : 
      'No matches found';
}

function clearHighlights() {
  document.querySelectorAll('.search-highlight').forEach(highlight => {
      const parent = highlight.parentNode;
      parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      // Clean up empty spans
      if (parent.tagName === 'SPAN' && !parent.innerHTML.trim()) {
          parent.parentNode.removeChild(parent);
      }
  });
}

// Modify your init function to include search initialization
function init() {
  console.log('Initializing...');
  makeAccessible();
  addControlPanel();
  createSearchBox(); // Add this line
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
      
      // Get URL from request data or sender
      const url = request.data?.url || sender.tab?.url;
      console.log('URL from request:', url); // Debug log
      
      if (domReady) {
        processSchemaDebounced(
          request.data.schemas, 
          request.data.pageTitle, 
          request.data.pageDescription, 
          request.data.homepageTitle,
          url
        );
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          processSchemaDebounced(
            request.data.schemas, 
            request.data.pageTitle, 
            request.data.pageDescription, 
            request.data.homepageTitle,
            url
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
    
    // Try to get URL from multiple sources
    let url;
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getOriginalTabUrl' }, resolve);
      });
      
      url = response?.url;
      
      if (!url) {
        // Fallback to trying to get URL from schemas
        const webPageSchema = rankedSchemas.find(s => s.schema['@type'] === 'WebPage');
        url = webPageSchema?.schema?.url;
      }
      
      if (!url) {
        throw new Error('No URL returned from background script');
      }
    } catch (error) {
      throw new Error('Unable to determine page URL: ' + error.message);
    }

    console.log('Using URL:', url); // Debug log

    const recommendations = await generateRecommendations(
      rankedSchemas, 
      pageTitle, 
      pageDescription, 
      homepageTitle,
      url
    );
    
    displayRecommendations(recommendations);
    clearStatus('rawSchemas');
  } catch (error) {
    console.error('Error processing schemas:', error);
    schemaError('rawSchemas', error.message);
  }
}

window.addEventListener('error', (event) => {
  console.error('View error:', event.error);
  schemaError('rawSchemas', event.error.message); // Use the renamed error handler
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