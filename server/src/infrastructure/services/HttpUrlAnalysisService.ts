import { UrlAnalysisService, UrlAnalysisResult, UrlSource } from '../../domain/services/UrlAnalysisService';

export class HttpUrlAnalysisService implements UrlAnalysisService {
  async analyzeUrl(url: string): Promise<UrlAnalysisResult> {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const pathname = urlObj.pathname.toLowerCase();

      // Remove 'www.' and 'm.' prefixes for consistent matching
      const cleanHostname = hostname.replace(/^(www\.|m\.)/, '');

      // Facebook detection
      if (this.isFacebookUrl(cleanHostname, pathname)) {
        return {
          source: 'facebook',
          detectedType: this.detectFacebookType(pathname)
        };
      }

      // Instagram detection
      if (this.isInstagramUrl(cleanHostname, pathname)) {
        return {
          source: 'instagram',
          detectedType: this.detectInstagramType(pathname)
        };
      }

      // Threads detection
      if (this.isThreadsUrl(cleanHostname, pathname)) {
        return {
          source: 'threads',
          detectedType: 'post'
        };
      }

      // YouTube detection
      if (this.isYouTubeUrl(cleanHostname, pathname)) {
        return {
          source: 'youtube',
          detectedType: this.detectYouTubeType(pathname, urlObj.searchParams)
        };
      }

      // No known source detected
      return {};
    } catch (error) {
      // Invalid URL or other errors
      return {};
    }
  }

  private isFacebookUrl(hostname: string, pathname: string): boolean {
    return hostname.includes('facebook.com') || hostname.includes('fb.com');
  }

  private isInstagramUrl(hostname: string, pathname: string): boolean {
    return hostname.includes('instagram.com');
  }

  private isThreadsUrl(hostname: string, pathname: string): boolean {
    return hostname.includes('threads');
  }

  private isYouTubeUrl(hostname: string, pathname: string): boolean {
    return hostname.includes('youtube.com') || hostname.includes('youtu.be');
  }

  private detectFacebookType(pathname: string): string {
    if (pathname.includes('/posts/') || pathname.includes('/permalink/')) {
      return 'post';
    }
    if (pathname.includes('/videos/')) {
      return 'video';
    }
    if (pathname.includes('/photos/')) {
      return 'photo';
    }
    if (pathname.includes('/events/')) {
      return 'event';
    }
    return 'post'; // Default to post
  }

  private detectInstagramType(pathname: string): string {
    if (pathname.includes('/reel/')) {
      return 'reel';
    }
    if (pathname.includes('/p/')) {
      return 'post';
    }
    if (pathname.includes('/stories/')) {
      return 'story';
    }
    if (pathname.includes('/tv/')) {
      return 'video';
    }
    return 'post'; // Default to post
  }

  private detectYouTubeType(pathname: string, searchParams: URLSearchParams): string {
    // YouTube Shorts
    if (pathname.includes('/shorts/')) {
      return 'short';
    }
    
    // YouTube regular videos
    if (pathname.includes('/watch') && searchParams.has('v')) {
      return 'video';
    }
    
    // YouTube short URLs (youtu.be)
    if (pathname.length > 1 && !pathname.includes('/')) {
      return 'video';
    }
    
    // YouTube playlist
    if (pathname.includes('/playlist') && searchParams.has('list')) {
      return 'playlist';
    }
    
    // YouTube channel
    if (pathname.includes('/channel/') || pathname.includes('/c/') || pathname.includes('/@')) {
      return 'channel';
    }
    
    return 'video'; // Default to video
  }
} 