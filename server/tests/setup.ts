import { vi } from 'vitest';

// 測試中不輸出 log，也不寫入 logs/ 目錄
vi.mock('../src/utils/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), http: vi.fn(), debug: vi.fn() }
}));
