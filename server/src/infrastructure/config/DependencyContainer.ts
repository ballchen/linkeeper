import { UrlRepository } from '../../domain/repositories/UrlRepository';
import { MetadataService } from '../../domain/services/MetadataService';
import { UrlAnalysisService } from '../../domain/services/UrlAnalysisService';
import { AddUrlUseCase } from '../../application/use-cases/AddUrlUseCase';
import { GetUrlsUseCase } from '../../application/use-cases/GetUrlsUseCase';
import { MongoUrlRepository } from '../database/MongoUrlRepository';
import { HttpMetadataService } from '../services/HttpMetadataService';
import { HttpUrlAnalysisService } from '../services/HttpUrlAnalysisService';
import { UrlController } from '../web/controllers/UrlController';

export class DependencyContainer {
  private static instance: DependencyContainer;
  
  private _urlRepository: UrlRepository;
  private _metadataService: MetadataService;
  private _urlAnalysisService: UrlAnalysisService;
  private _addUrlUseCase: AddUrlUseCase;
  private _getUrlsUseCase: GetUrlsUseCase;
  private _urlController: UrlController;

  private constructor() {
    // Infrastructure layer
    this._urlRepository = new MongoUrlRepository();
    this._metadataService = new HttpMetadataService();
    this._urlAnalysisService = new HttpUrlAnalysisService();

    // Application layer
    this._addUrlUseCase = new AddUrlUseCase(
      this._urlRepository,
      this._metadataService,
      this._urlAnalysisService
    );
    this._getUrlsUseCase = new GetUrlsUseCase(this._urlRepository);

    // Interface adapters layer
    this._urlController = new UrlController(
      this._addUrlUseCase,
      this._getUrlsUseCase
    );
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

  get addUrlUseCase(): AddUrlUseCase {
    return this._addUrlUseCase;
  }

  get getUrlsUseCase(): GetUrlsUseCase {
    return this._getUrlsUseCase;
  }

  get urlController(): UrlController {
    return this._urlController;
  }
} 