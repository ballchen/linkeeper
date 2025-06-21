#!/usr/bin/env node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { DependencyContainer } from '../infrastructure/config/DependencyContainer';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/url-saver';

interface ReanalysisStats {
  total: number;
  success: number;
  failed: number;
  imagesUpdated: number;
  imagesSkipped: number;
  imagesFailed: number;
}

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
    const s3ImageService = container.s3ImageService;

    // Fetch all URLs from database
    logger.info('Fetching all URLs from database...');
    const urls = await urlRepository.findAll();
    logger.info(`Found ${urls.length} URLs to re-analyze`);

    if (urls.length === 0) {
      logger.info('No URLs found in database. Exiting.');
      return;
    }

    const stats: ReanalysisStats = {
      total: urls.length,
      success: 0,
      failed: 0,
      imagesUpdated: 0,
      imagesSkipped: 0,
      imagesFailed: 0
    };

    // Process each URL
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      logger.info(`\nProcessing URL ${i + 1}/${urls.length}: ${url.url}`);

      try {
        // Re-analyze URL to get source and type information
        logger.info('  → Re-analyzing URL source...');
        const analysisResult = await urlAnalysisService.analyzeUrl(url.url);
        
        // Fetch fresh metadata (this will automatically handle S3 image upload)
        logger.info('  → Fetching fresh metadata and uploading images to S3...');
        const newMetadata = await metadataService.fetchMetadata(url.url);

        // Check if we got a new S3 image
        let imageStatus = 'no-change';
        if (newMetadata.image && newMetadata.image !== url.metadata.image) {
          if (newMetadata.image.startsWith('images/')) {
            imageStatus = 'uploaded-to-s3';
            stats.imagesUpdated++;
            logger.info(`  → ✓ Image uploaded to S3: ${newMetadata.image}`);
          } else {
            imageStatus = 'url-updated';
            stats.imagesUpdated++;
            logger.info(`  → ✓ Image URL updated: ${newMetadata.image}`);
          }
        } else if (!newMetadata.image && url.metadata.image) {
          imageStatus = 'image-lost';
          stats.imagesFailed++;
          logger.warn(`  → ⚠ Image no longer available for URL`);
        } else if (!newMetadata.image) {
          imageStatus = 'no-image';
          stats.imagesSkipped++;
          logger.info(`  → ℹ No image found for URL`);
        } else {
          stats.imagesSkipped++;
          logger.info(`  → ℹ Image unchanged`);
        }

        // Combine analysis result with metadata, preserving existing tags
        const updatedMetadata = {
          ...newMetadata,
          source: analysisResult.source,
          tags: url.metadata.tags || [] // Preserve existing tags
        };

        // Update the URL with new metadata
        const updatedUrl = url.updateMetadata(updatedMetadata);
        
        // Save to database
        await urlRepository.update(updatedUrl);
        
        stats.success++;
        logger.info(`  → ✓ Successfully updated URL with new metadata`);
        
        // Log what was updated
        const updates: string[] = [];
        if (analysisResult.source !== url.metadata.source) {
          updates.push(`source: ${url.metadata.source || 'none'} → ${analysisResult.source || 'none'}`);
        }
        if (newMetadata.title !== url.metadata.title) {
          updates.push(`title updated`);
        }
        if (newMetadata.description !== url.metadata.description) {
          updates.push(`description updated`);
        }
        if (imageStatus !== 'no-change') {
          updates.push(`image ${imageStatus}`);
        }
        
        if (updates.length > 0) {
          logger.info(`  → Updates: ${updates.join(', ')}`);
        }
        
        // Add a small delay to avoid overwhelming external services
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        stats.failed++;
        logger.error(`  → ✗ Failed to update URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // If it's an image-related error, still try to update other metadata
        if (error instanceof Error && error.message.includes('image')) {
          logger.info('  → Attempting to update metadata without image...');
          try {
            const analysisResult = await urlAnalysisService.analyzeUrl(url.url);
            const updatedMetadata = {
              ...url.metadata,
              source: analysisResult.source,
              image: '', // Clear failed image
            };
            const updatedUrl = url.updateMetadata(updatedMetadata);
            await urlRepository.update(updatedUrl);
            
            stats.failed--; // Remove from failed count
            stats.success++; // Add to success count
            stats.imagesFailed++;
            logger.info('  → ✓ Updated metadata without image');
          } catch (fallbackError) {
            logger.error(`  → ✗ Fallback update also failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
          }
        }
      }
    }

    // Final summary
    logger.info('\n' + '='.repeat(50));
    logger.info('🎉 RE-ANALYSIS COMPLETE');
    logger.info('='.repeat(50));
    logger.info(`📊 OVERALL STATISTICS:`);
    logger.info(`   Total URLs processed: ${stats.total}`);
    logger.info(`   ✅ Successfully updated: ${stats.success}`);
    logger.info(`   ❌ Failed: ${stats.failed}`);
    logger.info(`   📈 Success rate: ${((stats.success / stats.total) * 100).toFixed(2)}%`);
    logger.info('');
    logger.info(`🖼️ IMAGE STATISTICS:`);
    logger.info(`   🔄 Images updated/uploaded: ${stats.imagesUpdated}`);
    logger.info(`   ⏭️ Images skipped (unchanged): ${stats.imagesSkipped}`);
    logger.info(`   ⚠️ Image processing failed: ${stats.imagesFailed}`);
    logger.info('');
    
    if (stats.failed > 0) {
      logger.warn(`⚠️ ${stats.failed} URLs failed to update. Check logs above for details.`);
    }
    
    if (stats.imagesUpdated > 0) {
      logger.info(`✨ ${stats.imagesUpdated} images were successfully uploaded to S3!`);
    }

  } catch (error) {
    logger.error(`💥 Script failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  } finally {
    // Disconnect from MongoDB
    logger.info('Disconnecting from MongoDB...');
    await mongoose.disconnect();
    logger.info('✅ Disconnected from MongoDB');
    process.exit(0);
  }
}

// Handle script termination
process.on('SIGINT', async () => {
  logger.info('\n🛑 Script interrupted by user. Cleaning up...');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('\n🛑 Script terminated. Cleaning up...');
  await mongoose.disconnect();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  logger.info('🚀 Starting URL re-analysis script with S3 image upload...');
  logger.info('This script will:');
  logger.info('  1. Re-analyze all URLs for source detection');
  logger.info('  2. Fetch fresh metadata');  
  logger.info('  3. Download and upload images to S3');
  logger.info('  4. Update database with new information');
  logger.info('');
  reanalyzeAllUrls();
}

export { reanalyzeAllUrls }; 