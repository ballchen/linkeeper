import dotenv from 'dotenv';
import { DependencyContainer } from '../infrastructure/config/DependencyContainer';
import logger from '../utils/logger';

dotenv.config();

interface TestUrl {
  url: string;
  description: string;
}

// Test URLs covering different types of websites
const testUrls: TestUrl[] = [
  {
    url: 'https://youtu.be/dQw4w9WgXcQ',
    description: 'YouTube video (youtu.be format)'
  },
  {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    description: 'YouTube video (youtube.com format)'
  },
  {
    url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    description: 'YouTube Shorts'
  },
  {
    url: 'https://example.com',
    description: 'Regular website (fallback test)'
  }
];

async function testMetadataFetching(): Promise<void> {
  console.log('\n🧪 Starting Metadata Parsing Tests\n');
  console.log('='.repeat(60));

  const container = DependencyContainer.getInstance();
  const metadataService = container.metadataService;
  const urlAnalysisService = container.urlAnalysisService;

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < testUrls.length; i++) {
    const { url, description } = testUrls[i];
    
    console.log(`\n📋 Test ${i + 1}/${testUrls.length}: ${description}`);
    console.log(`🔗 URL: ${url}`);
    console.log('-'.repeat(40));

    try {
      // Test metadata fetching
      const startTime = Date.now();
      const metadata = await metadataService.fetchMetadata(url);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Test URL analysis
      const analysis = await urlAnalysisService.analyzeUrl(url);

      // Display results
      console.log(`✅ Success (${duration}ms)`);
      console.log(`📝 Title: ${metadata.title || 'N/A'}`);
      console.log(`📄 Description: ${metadata.description || 'N/A'}`);
      console.log(`🖼️  Image: ${metadata.image || 'N/A'}`);
      
      if (analysis.source) {
        console.log(`🎯 Source: ${analysis.source}`);
      }
      
      if (analysis.detectedType) {
        console.log(`🏷️  Type: ${analysis.detectedType}`);
      }

      successCount++;
    } catch (error: any) {
      console.log(`❌ Failed: ${error.message}`);
      failureCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log(`✅ Successful: ${successCount}/${testUrls.length}`);
  console.log(`❌ Failed: ${failureCount}/${testUrls.length}`);
  console.log(`📈 Success Rate: ${((successCount / testUrls.length) * 100).toFixed(1)}%`);
}

async function testSingleUrl(url: string): Promise<void> {
  console.log('\n🔍 Testing Single URL\n');
  console.log('='.repeat(60));
  console.log(`🔗 URL: ${url}`);
  console.log('-'.repeat(40));

  const container = DependencyContainer.getInstance();
  const metadataService = container.metadataService;
  const urlAnalysisService = container.urlAnalysisService;

  try {
    const startTime = Date.now();
    
    // Run both services in parallel
    const [metadata, analysis] = await Promise.all([
      metadataService.fetchMetadata(url),
      urlAnalysisService.analyzeUrl(url)
    ]);
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Success (${duration}ms)`);
    console.log('\n📋 Metadata:');
    console.log(`  📝 Title: ${metadata.title || 'N/A'}`);
    console.log(`  📄 Description: ${metadata.description || 'N/A'}`);
    console.log(`  🖼️  Image: ${metadata.image || 'N/A'}`);
    
    console.log('\n🎯 Analysis:');
    console.log(`  🌐 Source: ${analysis.source || 'N/A'}`);
    console.log(`  🏷️  Type: ${analysis.detectedType || 'N/A'}`);

  } catch (error: any) {
    console.log(`❌ Failed: ${error.message}`);
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length > 0) {
      // Test single URL provided as argument
      const url = args[0];
      await testSingleUrl(url);
    } else {
      // Run comprehensive test suite
      await testMetadataFetching();
    }
  } catch (error: any) {
    logger.error('Test script failed:', error);
    console.error('❌ Test script failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Test interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Test terminated');
  process.exit(0);
});

// Export for potential module usage
export { testMetadataFetching, testSingleUrl };

// Run if called directly
if (require.main === module) {
  main();
}
