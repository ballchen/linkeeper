import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import axios from 'axios';
import { createHash } from 'crypto';
import path from 'path';
import logger from '../../utils/logger';

export interface S3ImageService {
  uploadImageFromUrl(imageUrl: string, originalUrl: string): Promise<string | null>;
  getImageUrl(s3Key: string): Promise<string>;
}

export class AWSS3ImageService implements S3ImageService {
  private s3Client: S3Client;
  private bucketName: string;
  private folderName: string;

  constructor() {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    this.bucketName = process.env.AWS_S3_BUCKET || 'linkeeper';
    this.folderName = 'images';
  }

  async uploadImageFromUrl(imageUrl: string, originalUrl: string): Promise<string | null> {
    try {
      // Skip if no image URL provided
      if (!imageUrl || imageUrl.trim() === '') {
        logger.info('No image URL provided, skipping upload');
        return null;
      }

      logger.info(`Starting image upload from URL: ${imageUrl}`);

      // Download image from URL
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000, // 30 seconds timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LinkKeeper/1.0)',
          'Accept': 'image/*',
        },
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
        maxBodyLength: 10 * 1024 * 1024, // 10MB limit
      });

      // Check if response is actually an image
      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        logger.warn(`URL does not point to an image: ${imageUrl}`);
        return null;
      }

      // Generate unique filename based on original URL and image URL
      const hash = createHash('md5').update(originalUrl + imageUrl).digest('hex');
      const extension = this.getImageExtension(contentType);
      const filename = `${hash}.${extension}`;
      const s3Key = `${this.folderName}/${filename}`;

      // Check if image already exists in S3
      try {
        await this.s3Client.send(new GetObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key
        }));
        
        logger.info(`Image already exists in S3: ${s3Key}`);
        return s3Key;
      } catch (error: any) {
        // If image doesn't exist (404), continue with upload
        if (error.name !== 'NoSuchKey') {
          logger.error(`Error checking if image exists in S3: ${error.message}`);
        }
      }

      // Upload image to S3
      const putCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: Buffer.from(response.data),
        ContentType: contentType,
        ContentLength: response.data.byteLength,
        Metadata: {
          'original-url': originalUrl,
          'source-image-url': imageUrl,
          'uploaded-at': new Date().toISOString()
        }
      });

      await this.s3Client.send(putCommand);
      logger.info(`Image successfully uploaded to S3: ${s3Key}`);

      return s3Key;
    } catch (error: any) {
      logger.error(`Error uploading image to S3: ${error.message}`);
      
      // Return null on error to allow the URL to be saved without image
      return null;
    }
  }

  async getImageUrl(s3Key: string): Promise<string> {
    try {
      // Generate a presigned URL that expires in 1 hour
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn: 3600 // 1 hour
      });

      return signedUrl;
    } catch (error: any) {
      logger.error(`Error generating presigned URL for S3 key ${s3Key}: ${error.message}`);
      throw new Error(`Failed to generate image URL: ${error.message}`);
    }
  }

  private getImageExtension(contentType: string): string {
    const extensionMap: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/bmp': 'bmp',
      'image/svg+xml': 'svg',
      'image/tiff': 'tiff'
    };

    return extensionMap[contentType.toLowerCase()] || 'jpg';
  }
} 