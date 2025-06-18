#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { DependencyContainer } from '../infrastructure/config/DependencyContainer';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/url-saver';

async function reanalyzeAllUrls() {
  try {
    // Connect to MongoDB
    logger.info('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    logger.info('Connected to MongoDB successfully');

    // Get dependency container
    const container = DependencyContainer.getInstance();
    const urlRepository = container.urlRepository;
    const metadataService = container.metadataService;
    const urlAnalysisService = container.urlAnalysisService;

    // Fetch all URLs from database
    logger.info('Fetching all URLs from database...');
    const urls = await urlRepository.findAll();
    logger.info(`Found ${urls.length} URLs to re-analyze`);

    if (urls.length === 0) {
      logger.info('No URLs found in database. Exiting.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Process each URL
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      logger.info(`Processing URL ${i + 1}/${urls.length}: ${url.url}`);

      try {
        // Re-analyze URL to get source and type information
        const analysisResult = await urlAnalysisService.analyzeUrl(url.url);
        
        // Fetch fresh metadata
        const newMetadata = await metadataService.fetchMetadata(url.url);

        // Combine analysis result with metadata
        const updatedMetadata = {
          ...newMetadata,
          source: analysisResult.source,
          tags: url.metadata.tags || [] // Preserve existing tags
        };

        // Update the URL with new metadata
        const updatedUrl = url.updateMetadata(updatedMetadata);
        
        // Save to database
        await urlRepository.update(updatedUrl);
        
        successCount++;
        logger.info(`✓ Successfully updated URL: ${url.url}`);
        
        // Add a small delay to avoid overwhelming external services
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        errorCount++;
        logger.error(`✗ Failed to update URL: ${url.url} - Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Summary
    logger.info('\n=== Re-analysis Complete ===');
    logger.info(`Total URLs processed: ${urls.length}`);
    logger.info(`Successfully updated: ${successCount}`);
    logger.info(`Failed: ${errorCount}`);
    logger.info(`Success rate: ${((successCount / urls.length) * 100).toFixed(2)}%`);

  } catch (error) {
    logger.error(`Script failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  } finally {
    // Disconnect from MongoDB
    logger.info('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
    process.exit(0);
  }
}

// Handle script termination
process.on('SIGINT', async () => {
  logger.info('Script interrupted. Cleaning up...');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Script terminated. Cleaning up...');
  await mongoose.disconnect();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  logger.info('Starting URL re-analysis script...');
  reanalyzeAllUrls();
}

export { reanalyzeAllUrls }; 