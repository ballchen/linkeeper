import axios from 'axios';
import logger from '../../utils/logger';
import { UrlMetadata } from '../../domain/entities/Url';

export interface YouTubeVideoInfo {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  publishedAt: string;
  duration: string;
  viewCount?: string;
  likeCount?: string;
}

export class YouTubeApiService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor() {
    this.apiKey = process.env.YOUTUBE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('YouTube API key not found. YouTube API features will be disabled.');
    }
  }

  /**
   * Extract YouTube video ID from various YouTube URL formats
   */
  extractVideoId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      
      // Handle youtu.be short URLs
      if (urlObj.hostname === 'youtu.be') {
        return urlObj.pathname.slice(1).split('?')[0];
      }
      
      // Handle youtube.com URLs
      if (urlObj.hostname.includes('youtube.com')) {
        // Regular watch URLs: /watch?v=VIDEO_ID
        if (urlObj.pathname === '/watch' && urlObj.searchParams.has('v')) {
          return urlObj.searchParams.get('v');
        }
        
        // Shorts URLs: /shorts/VIDEO_ID
        if (urlObj.pathname.startsWith('/shorts/')) {
          return urlObj.pathname.replace('/shorts/', '');
        }
        
        // Embed URLs: /embed/VIDEO_ID
        if (urlObj.pathname.startsWith('/embed/')) {
          return urlObj.pathname.replace('/embed/', '');
        }
      }
      
      return null;
    } catch (error) {
      logger.error(`Error extracting video ID from URL: ${url}`, error);
      return null;
    }
  }

  /**
   * Check if URL is a YouTube video URL
   */
  isYouTubeVideoUrl(url: string): boolean {
    return this.extractVideoId(url) !== null;
  }

  /**
   * Fetch YouTube video metadata using YouTube Data API
   */
  async fetchVideoMetadata(videoId: string): Promise<UrlMetadata | null> {
    if (!this.apiKey) {
      logger.warn('YouTube API key not available, skipping API call');
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/videos`, {
        params: {
          id: videoId,
          key: this.apiKey,
          part: 'snippet,contentDetails,statistics'
        },
        timeout: 10000
      });

      const data = response.data;
      
      if (!data.items || data.items.length === 0) {
        logger.warn(`No video found for ID: ${videoId}`);
        return null;
      }

      const video = data.items[0];
      const snippet = video.snippet;
      const statistics = video.statistics || {};

      // Get the highest quality thumbnail available
      const thumbnails = snippet.thumbnails;
      const thumbnailUrl = thumbnails.maxres?.url || 
                          thumbnails.high?.url || 
                          thumbnails.medium?.url || 
                          thumbnails.default?.url || '';

      logger.info(`Successfully fetched YouTube metadata for video: ${videoId}`);

      return {
        title: snippet.title || '',
        description: snippet.description || '',
        image: thumbnailUrl,
        tags: snippet.tags || []
      };
    } catch (error: any) {
      if (error.response?.status === 403) {
        logger.error('YouTube API quota exceeded or API key invalid');
      } else if (error.response?.status === 404) {
        logger.warn(`YouTube video not found: ${videoId}`);
      } else {
        logger.error(`Error fetching YouTube metadata for video ${videoId}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Fetch YouTube video metadata by URL
   */
  async fetchMetadataByUrl(url: string): Promise<UrlMetadata | null> {
    const videoId = this.extractVideoId(url);
    if (!videoId) {
      logger.warn(`Could not extract video ID from URL: ${url}`);
      return null;
    }

    return this.fetchVideoMetadata(videoId);
  }

  /**
   * Get detailed video information (for potential future use)
   */
  async getVideoInfo(videoId: string): Promise<YouTubeVideoInfo | null> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/videos`, {
        params: {
          id: videoId,
          key: this.apiKey,
          part: 'snippet,contentDetails,statistics'
        }
      });

      const data = response.data;
      if (!data.items || data.items.length === 0) {
        return null;
      }

      const video = data.items[0];
      const snippet = video.snippet;
      const contentDetails = video.contentDetails;
      const statistics = video.statistics || {};

      return {
        id: videoId,
        title: snippet.title,
        description: snippet.description,
        thumbnailUrl: snippet.thumbnails?.high?.url || '',
        channelTitle: snippet.channelTitle,
        publishedAt: snippet.publishedAt,
        duration: contentDetails.duration,
        viewCount: statistics.viewCount,
        likeCount: statistics.likeCount
      };
    } catch (error) {
      logger.error(`Error fetching YouTube video info for ${videoId}:`, error);
      return null;
    }
  }
}
