import axios from 'axios';
import * as cheerio from 'cheerio';
import { MetadataService } from '../../domain/services/MetadataService';
import { UrlMetadata } from '../../domain/entities/Url';
import { S3ImageService } from './S3ImageService';
import logger from '../../utils/logger';

export class HttpMetadataService implements MetadataService {
  private readonly timeout = 10000; // 10 seconds
  
  // User Agent rotation for better success rate against 429 errors
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0'
  ];

  constructor(private readonly s3ImageService: S3ImageService) {}

  /**
   * Get a random User Agent from the pool to avoid detection
   */
  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Get optimized headers that mimic real browser requests
   */
  private getOptimizedHeaders(): Record<string, string> {
    return {
      'User-Agent': this.getRandomUserAgent(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,zh-TW;q=0.8,zh;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    };
  }

  async fetchMetadata(url: string): Promise<UrlMetadata> {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: this.getOptimizedHeaders()
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