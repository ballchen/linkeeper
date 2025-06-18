import axios from 'axios';
import * as cheerio from 'cheerio';
import { MetadataService } from '../../domain/services/MetadataService';
import { UrlMetadata } from '../../domain/entities/Url';

export class HttpMetadataService implements MetadataService {
  private readonly timeout = 10000; // 10 seconds
  private readonly userAgent = 'Mozilla/5.0 (compatible; URL-Saver-Bot/1.0)';

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
      const image = this.extractImage($);

      return {
        title,
        description,
        image
      };
    } catch (error) {
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