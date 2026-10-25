import { UrlRepository } from '../../domain/repositories/UrlRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { MetadataService } from '../../domain/services/MetadataService';
import { UrlAnalysisService } from '../../domain/services/UrlAnalysisService';
import { AddUrlUseCase } from '../../application/use-cases/AddUrlUseCase';
import { GetUrlsUseCase } from '../../application/use-cases/GetUrlsUseCase';
import { DeleteUrlUseCase } from '../../application/use-cases/DeleteUrlUseCase';
import { AuthUseCase } from '../../application/use-cases/AuthUseCase';
import { EnrichUrlUseCase } from '../../application/use-cases/EnrichUrlUseCase';
import { UpdateUrlTagsUseCase } from '../../application/use-cases/UpdateUrlTagsUseCase';
import { RefreshUrlUseCase } from '../../application/use-cases/RefreshUrlUseCase';
import { DeviceTokenUseCase } from '../../application/use-cases/DeviceTokenUseCase';
import { DeviceTokenRepository } from '../../domain/repositories/DeviceTokenRepository';
import { MongoDeviceTokenRepository } from '../database/MongoDeviceTokenRepository';
import { InProcessUrlEnrichmentQueue } from '../services/InProcessUrlEnrichmentQueue';
import { DeviceController } from '../web/controllers/DeviceController';
import { createDualAuth } from '../../middleware/dualAuth';
import { RequestHandler } from 'express';
import { MongoUrlRepository } from '../database/MongoUrlRepository';
import { MongoUserRepository } from '../database/MongoUserRepository';
import { HttpMetadataService } from '../services/HttpMetadataService';
import { HttpUrlAnalysisService } from '../services/HttpUrlAnalysisService';
import { AWSS3ImageService, S3ImageService } from '../services/S3ImageService';
import { YouTubeApiService } from '../services/YouTubeApiService';
import { UrlController } from '../web/controllers/UrlController';
import { AuthController } from '../web/controllers/AuthController';

export class DependencyContainer {
  private static instance: DependencyContainer;
  
  private _urlRepository: UrlRepository;
  private _userRepository: UserRepository;
  private _deviceTokenRepository: DeviceTokenRepository;
  private _s3ImageService: S3ImageService;
  private _youtubeApiService: YouTubeApiService;
  private _metadataService: MetadataService;
  private _urlAnalysisService: UrlAnalysisService;
  private _addUrlUseCase: AddUrlUseCase;
  private _getUrlsUseCase: GetUrlsUseCase;
  private _deleteUrlUseCase: DeleteUrlUseCase;
  private _updateUrlTagsUseCase: UpdateUrlTagsUseCase;
  private _refreshUrlUseCase: RefreshUrlUseCase;
  private _enrichUrlUseCase: EnrichUrlUseCase;
  private _enrichmentQueue: InProcessUrlEnrichmentQueue;
  private _authUseCase: AuthUseCase;
  private _deviceTokenUseCase: DeviceTokenUseCase;
  private _urlController: UrlController;
  private _authController: AuthController;
  private _deviceController: DeviceController;
  private _dualAuth: RequestHandler;

  private constructor() {
    // Infrastructure layer
    this._urlRepository = new MongoUrlRepository();
    this._userRepository = new MongoUserRepository();
    this._deviceTokenRepository = new MongoDeviceTokenRepository();
    this._s3ImageService = new AWSS3ImageService();
    this._youtubeApiService = new YouTubeApiService();
    this._metadataService = new HttpMetadataService(this._s3ImageService, this._youtubeApiService);
    this._urlAnalysisService = new HttpUrlAnalysisService();

    // Application layer
    this._enrichUrlUseCase = new EnrichUrlUseCase(this._urlRepository, this._metadataService);
    this._enrichmentQueue = new InProcessUrlEnrichmentQueue(this._enrichUrlUseCase, this._urlRepository);
    this._addUrlUseCase = new AddUrlUseCase(
      this._urlRepository,
      this._urlAnalysisService,
      this._enrichmentQueue
    );
    this._getUrlsUseCase = new GetUrlsUseCase(this._urlRepository);
    this._deleteUrlUseCase = new DeleteUrlUseCase(this._urlRepository);
    this._updateUrlTagsUseCase = new UpdateUrlTagsUseCase(this._urlRepository);
    this._refreshUrlUseCase = new RefreshUrlUseCase(this._urlRepository, this._enrichmentQueue);
    this._authUseCase = new AuthUseCase(this._userRepository);
    this._deviceTokenUseCase = new DeviceTokenUseCase(this._deviceTokenRepository);

    // Interface adapters layer  
    this._urlController = new UrlController(
      this._addUrlUseCase,
      this._getUrlsUseCase,
      this._deleteUrlUseCase,
      this._updateUrlTagsUseCase,
      this._refreshUrlUseCase,
      this._s3ImageService
    );
    this._authController = new AuthController(this._authUseCase);
    this._deviceController = new DeviceController(this._deviceTokenUseCase);
    this._dualAuth = createDualAuth(this._deviceTokenUseCase);
  }

  static getInstance(): DependencyContainer {
    if (!DependencyContainer.instance) {
      DependencyContainer.instance = new DependencyContainer();
    }
    return DependencyContainer.instance;
  }

  get urlRepository(): UrlRepository {
    return this._urlRepository;
  }

  get metadataService(): MetadataService {
    return this._metadataService;
  }

  get urlAnalysisService(): UrlAnalysisService {
    return this._urlAnalysisService;
  }

  get urlController(): UrlController {
    return this._urlController;
  }

  get addUrlUseCase(): AddUrlUseCase {
    return this._addUrlUseCase;
  }

  get getUrlsUseCase(): GetUrlsUseCase {
    return this._getUrlsUseCase;
  }

  get deleteUrlUseCase(): DeleteUrlUseCase {
    return this._deleteUrlUseCase;
  }

  get s3ImageService(): S3ImageService {
    return this._s3ImageService;
  }

  get userRepository(): UserRepository {
    return this._userRepository;
  }

  get authUseCase(): AuthUseCase {
    return this._authUseCase;
  }

  get authController(): AuthController {
    return this._authController;
  }

  get deviceController(): DeviceController {
    return this._deviceController;
  }

  get dualAuth(): RequestHandler {
    return this._dualAuth;
  }

  get enrichmentQueue(): InProcessUrlEnrichmentQueue {
    return this._enrichmentQueue;
  }

  get youtubeApiService(): YouTubeApiService {
    return this._youtubeApiService;
  }
} 