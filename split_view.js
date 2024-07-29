document.addEventListener('DOMContentLoaded', function() {
    // This function is called once schemas are processed
    function displaySchemaDetails(title, description, menuItems) {
      const titleElement = document.getElementById('dynamicTitle');
      const descriptionBlock = document.getElementById('descriptionBlock');
      const dynamicMenu = document.getElementById('dynamicMenu');
  
      // Set the dynamic title
      titleElement.textContent = title || 'Default Title';
  
      // Set the description
      descriptionBlock.innerHTML = description ? `<p>${description}</p>` : '<p>Default description</p>';
  
      // Set the menu items
      if (menuItems && menuItems.length > 0) {
        dynamicMenu.innerHTML = '<ul>' + menuItems.map(item => `<li>${item}</li>`).join('') + '</ul>';
      } else {
        dynamicMenu.innerHTML = '<ul><li>Default Menu Item 1</li><li>Default Menu Item 2</li></ul>';
      }
    }
  
    // Function to find nested WebPage schema and extract description
    function extractNestedWebPageDescription(schema) {
      if (typeof schema === 'object' && schema !== null) {
        if (schema['@type'] === 'WebPage' && schema.description) {
          return schema.description;
        }
        for (const key in schema) {
          if (typeof schema[key] === 'object') {
            const result = extractNestedWebPageDescription(schema[key]);
            if (result) return result;
          }
        }
      }
      return null;
    }
  
    // Function to simulate schema parsing (for debugging)
    function processSchemas() {
      // Simulate a schema object for debugging
      const schema = {
        "@context": "http://schema.org",
        "@type": "WebSite",
        "name": "Debug Page",
        "hasPart": {
          "@type": "WebPage",
          "description": "This is a debug description.",
          "hasPart": {
            "@type": "SiteNavigationElement",
            "name": ["Menu Item 1", "Menu Item 2"]
          }
        }
      };
  
      try {
        const webSiteTitle = schema.name || 'Default Title';
        const webPageDescription = extractNestedWebPageDescription(schema);
        const menuItems = schema.hasPart && schema.hasPart.hasPart && schema.hasPart.hasPart.name ? schema.hasPart.hasPart.name : [];
        displaySchemaDetails(webSiteTitle, webPageDescription, menuItems);
      } catch (e) {
        console.error('Error parsing schema:', e);
      }
    }
  
    // Call processSchemas function after DOM is loaded
    processSchemas();
  });