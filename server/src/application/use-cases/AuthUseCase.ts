import { OAuth2Client } from 'google-auth-library';
import { User, UserData } from '../../domain/entities/User';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { generateJWT } from '../../middleware/jwtAuth';
import logger from '../../utils/logger';

export interface GoogleLoginResult {
  user: User;
  token: string;
  isNewUser: boolean;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export class AuthUseCase {
  private oauthClient: OAuth2Client;
  private allowedEmails: string[];

  constructor(private userRepository: UserRepository) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is required');
    }

    this.oauthClient = new OAuth2Client(clientId, clientSecret);
    
    // Load allowed emails from environment variable
    this.allowedEmails = process.env.ALLOWED_EMAILS?.split(',').map(email => email.trim()) || [];
    
    if (this.allowedEmails.length === 0) {
      logger.warn('No allowed emails configured. Anyone with a valid Google account can access the application.');
    } else {
      logger.info(`Allowed emails configured: ${this.allowedEmails.length} emails`);
    }
  }

  /**
   * Authenticate user with Google ID token
   */
  async loginWithGoogle(idToken: string): Promise<GoogleLoginResult> {
    try {
      // Verify Google ID token
      const ticket = await this.oauthClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      
      if (!payload || !payload.email || !payload.name) {
        throw new Error('Invalid Google token payload');
      }

      // Check if user is in allowed list
      if (this.allowedEmails.length > 0 && !this.allowedEmails.includes(payload.email)) {
        logger.warn(`Unauthorized Google login attempt from: ${payload.email}`);
        throw new Error('Your account is not authorized to access this application');
      }

      const googleUser: GoogleUserInfo = {
        id: payload.sub || '',
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      };

      // Check if user already exists
      let user = await this.userRepository.findByEmail(googleUser.email);
      let isNewUser = false;

      if (!user) {
        // Create new user
        const userData: UserData = {
          email: googleUser.email,
          name: googleUser.name,
          picture: googleUser.picture,
          lastLoginAt: new Date()
        };

        user = User.create(userData);
        user = await this.userRepository.save(user);
        isNewUser = true;
        
        logger.info(`New user created: ${user.email} (${user.name})`);
      } else {
        // Update last login time
        user = user.updateLastLogin();
        user = await this.userRepository.update(user);
        
        logger.info(`User logged in: ${user.email} (${user.name})`);
      }

      // Generate JWT token
      const token = generateJWT({
        id: user.id,
        email: user.email,
        name: user.name
      });

      return {
        user,
        token,
        isNewUser
      };

    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Google authentication failed: ${error.message}`);
        throw error;
      }
      
      logger.error(`Unknown error during Google authentication: ${error}`);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Verify if user is authorized to access the application
   */
  isEmailAllowed(email: string): boolean {
    if (this.allowedEmails.length === 0) {
      return true; // No restrictions
    }
    
    return this.allowedEmails.includes(email);
  }

  /**
   * Get allowed emails list (for admin purposes)
   */
  getAllowedEmails(): string[] {
    return [...this.allowedEmails];
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findByEmail(email);
  }
} 