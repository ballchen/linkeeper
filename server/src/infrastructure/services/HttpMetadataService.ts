import axios from 'axios';
import * as cheerio from 'cheerio';
import { MetadataService } from '../../domain/services/MetadataService';
import { UrlMetadata } from '../../domain/entities/Url';
import { S3ImageService } from './S3ImageService';
import logger from '../../utils/logger';

export class HttpMetadataService implements MetadataService {
  private readonly timeout = 10000; // 10 seconds
  private readonly userAgent = 'Mozilla/5.0 (compatible; URL-Saver-Bot/1.0)';

  constructor(private readonly s3ImageService: S3ImageService) {}

  async fetchMetadata(url: string): Promise<UrlMetadata> {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent
        }
      });

      const $ = cheerio.load(response.data);

      const title = this.extractTitle($);
      const description = this.extractDescription($);
      const originalImageUrl = this.extractImage($);

      // Upload image to S3 if available
      let s3ImageKey: string | null = null;
      if (originalImageUrl) {
        try {
          logger.info(`Uploading image to S3 for URL: ${url}`);
          s3ImageKey = await this.s3ImageService.uploadImageFromUrl(originalImageUrl, url);
          
          if (s3ImageKey) {
            logger.info(`Image uploaded to S3 successfully: ${s3ImageKey}`);
          } else {
            logger.warn(`Failed to upload image to S3 for URL: ${url}`);
          }
        } catch (error: any) {
          logger.error(`Error uploading image to S3: ${error.message}`);
        }
      }

      return {
        title,
        description,
        image: s3ImageKey || '' // Use S3 key instead of original URL
      };
    } catch (error) {
      logger.error(`Error fetching metadata for URL ${url}: ${error}`);
      // Return empty metadata if fetching fails
      return {
        title: '',
        description: '',
        image: ''
      };
    }
  }

  private extractTitle($: cheerio.CheerioAPI): string {
    return (
      $('meta[property="og:title"]').attr('content') ||
      $('meta[name="twitter:title"]').attr('content') ||
      $('meta[name="title"]').attr('content') ||
      $('title').first().text() ||
      ''
    );
  }

  private extractDescription($: cheerio.CheerioAPI): string {
    return (
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      ''
    );
  }

  private extractImage($: cheerio.CheerioAPI): string {
    return (
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="og:image:url"]').attr('content') ||
      $('meta[property="og:image:secure_url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      ''
    );
  }
} 