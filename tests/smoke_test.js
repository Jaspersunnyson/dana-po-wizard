const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const mammoth = require('mammoth');

(async () => {
  console.log('🧪 Running smoke test...\n');
  
    // Use the main template file
    const templateDir = 'template';
    const templateFile = 'po-noban.template.docx';
    const templatePath = path.join(templateDir, templateFile);
  
  if (!fs.existsSync(templatePath)) {
    console.log('⚠️  Template file not found, skipping smoke test');
    process.exit(0);
  }
  
  console.log(`📄 Using template: ${templateFile}`);
  
  // Load template and data
  const templateBuffer = fs.readFileSync(templatePath);
  const testData = JSON.parse(
    fs.readFileSync('tests/smoke_data.json', 'utf8')
  );
  
  // Render document
  console.log('🔧 Rendering document...');
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    errorLogging: true,
    delimiters: { start: '{{', end: '}}' },
    nullGetter() { return ''; }
  });
  
  try {
    doc.render(testData);
  } catch (error) {
    console.error('❌ Render failed:', error.message);
    if (error.properties) {
      console.error('Error details:', JSON.stringify(error.properties, null, 2));
    }
    process.exit(1);
  }
  
  // Generate output
  const outputBuffer = doc.getZip().generate({ type: 'nodebuffer' });
  fs.mkdirSync('dist', { recursive: true });
  const outputPath = path.join('dist', 'smoke-test-output.docx');
  fs.writeFileSync(outputPath, outputBuffer);
  console.log(`✅ Generated: ${outputPath}`);
  
  // Verify no leftover tags
  console.log('🔍 Checking for unrendered tags...');
  const htmlResult = await mammoth.convertToHtml({ buffer: outputBuffer });
  const leftoverTags = htmlResult.value.match(/\{\{[^}]+\}\}/g);
  
  if (leftoverTags) {
    console.error('❌ Found unrendered tags:', leftoverTags);
    process.exit(1);
  }
  
  console.log('✅ No unrendered tags found');
  console.log('\n✅ Smoke test PASSED');
})();
