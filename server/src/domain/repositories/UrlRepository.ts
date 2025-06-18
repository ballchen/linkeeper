import { Url } from '../entities/Url';

export interface UrlRepository {
  save(url: Url): Promise<Url>;
  findByUrl(url: string): Promise<Url | null>;
  findAll(): Promise<Url[]>;
  findById(id: string): Promise<Url | null>;
  delete(id: string): Promise<void>;
  update(url: Url): Promise<Url>;
} 