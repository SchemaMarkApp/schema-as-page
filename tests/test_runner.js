import { extractAllSchemas } from '../content.js';
import { processSchemas } from '../schema_ranker.js';

const tests = {
  async testSchemaExtraction() {
    const testHtml = `
      <script type="application/ld+json">
        {"@type": "WebSite", "name": "Test Site"}
      </script>
    `;
    const schemas = extractAllSchemas(testHtml);
    assert(schemas.length === 1);
    assert(schemas[0]['@type'] === 'WebSite');
  }
};

export async function runTests() {
  for (const [name, test] of Object.entries(tests)) {
    try {
      await test();
      console.log(`✓ ${name} passed`);
    } catch (error) {
      console.error(`✗ ${name} failed:`, error);
    }
  }
}