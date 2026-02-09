// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Image Host Utilities
 * Upload images to external hosting services for video generation
 */

import { useAPIConfigStore, type ImageHostProvider } from '@/stores/api-config-store';
import { ApiKeyManager, parseApiKeys } from '@/lib/api-key-manager';

// ==================== Types ====================

export interface UploadResult {
  success: boolean;
  url?: string;
  deleteUrl?: string;
  error?: string;
}

export interface UploadOptions {
  name?: string;
  expiration?: number;
  providerId?: string; // Optional: force a specific provider
}

// ==================== Key Managers ====================

type ProviderKeyManagerEntry = {
  manager: ApiKeyManager;
  keyString: string;
};

const imageHostKeyManagers = new Map<string, ProviderKeyManagerEntry>();
let providerCursor = 0;

function getProviderKeyManager(provider: ImageHostProvider): ApiKeyManager {
  const existing = imageHostKeyManagers.get(provider.id);
  if (existing && existing.keyString === provider.apiKey) {
    return existing.manager;
  }
  const manager = new ApiKeyManager(provider.apiKey);
  imageHostKeyManagers.set(provider.id, { manager, keyString: provider.apiKey });
  return manager;
}

// ==================== Helpers ====================

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function resolveUploadUrl(provider: ImageHostProvider): string {
  const uploadPath = (provider.uploadPath || '').trim();
  if (uploadPath && isHttpUrl(uploadPath)) {
    return uploadPath;
  }
  const baseUrl = (provider.baseUrl || '').trim().replace(/\/*$/, '');
  if (!baseUrl && !uploadPath) return '';
  if (!baseUrl && uploadPath) return '';
  if (!uploadPath) return baseUrl;
  const normalizedPath = uploadPath.startsWith('/') ? uploadPath : `/${uploadPath}`;
  return `${baseUrl}${normalizedPath}`;
}

function getByPath(obj: any, path?: string): any {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

async function toBase64Data(imageData: string): Promise<string> {
  // If it's a URL, fetch and convert
  if (isHttpUrl(imageData)) {
    const response = await fetch(imageData);
    const blob = await response.blob();
    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const parts = dataUrl.split(',');
    return parts.length === 2 ? parts[1] : dataUrl;
  }

  // Data URI -> strip prefix
  if (imageData.startsWith('data:')) {
    const parts = imageData.split(',');
    return parts.length === 2 ? parts[1] : imageData;
  }

  // Assume already base64
  return imageData;
}

async function uploadWithProvider(
  provider: ImageHostProvider,
  apiKey: string,
  imageData: string,
  options?: UploadOptions
): Promise<UploadResult> {
  try {
    const uploadUrl = resolveUploadUrl(provider);
    if (!uploadUrl) {
      return { success: false, error: '图床上传地址未配置' };
    }

    const fieldName = provider.imageField || 'image';
    const nameField = provider.nameField || 'name';
    const base64Data = await toBase64Data(imageData);

    const formData = new FormData();
    formData.append(fieldName, base64Data);
    if (options?.name) {
      formData.append(nameField, options.name);
    }

    const url = new URL(uploadUrl);
    if (provider.apiKeyParam) {
      url.searchParams.set(provider.apiKeyParam, apiKey);
    }
    if (provider.expirationParam && options?.expiration) {
      url.searchParams.set(provider.expirationParam, String(options.expiration));
    }

    const headers: Record<string, string> = {};
    if (provider.apiKeyHeader) {
      headers[provider.apiKeyHeader] = apiKey;
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: formData,
    });

    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const message = data?.error?.message || data?.message || text || `上传失败: ${response.status}`;
      return { success: false, error: message };
    }

    const urlField = getByPath(data, provider.responseUrlField || 'url');
    const deleteField = getByPath(data, provider.responseDeleteUrlField || 'delete_url');

    if (urlField) {
      return {
        success: true,
        url: typeof urlField === 'string' ? urlField : String(urlField),
        deleteUrl: deleteField ? (typeof deleteField === 'string' ? deleteField : String(deleteField)) : undefined,
      };
    }

    return { success: false, error: '上传成功但未返回 URL' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '上传失败' };
  }
}

function getRotatedProviders(providers: ImageHostProvider[]): ImageHostProvider[] {
  if (providers.length <= 1) return providers;
  const start = providerCursor % providers.length;
  providerCursor = (providerCursor + 1) % providers.length;
  return [...providers.slice(start), ...providers.slice(0, start)];
}

// ==================== Unified Upload API ====================

/**
 * Upload image to configured image host providers
 * Supports provider rotation + per-provider key rotation
 */
export async function uploadToImageHost(
  imageData: string,
  options?: UploadOptions
): Promise<UploadResult> {
  const store = useAPIConfigStore.getState();
  const targetProvider = options?.providerId
    ? store.getImageHostProviderById(options.providerId)
    : null;

  const providers = targetProvider
    ? (targetProvider.enabled ? [targetProvider] : [])
    : store.getEnabledImageHostProviders();

  if (!providers || providers.length === 0) {
    return { success: false, error: '图床未配置' };
  }

  const orderedProviders = getRotatedProviders(providers);
  let lastError = '上传失败';

  for (const provider of orderedProviders) {
    const keys = parseApiKeys(provider.apiKey);
    if (keys.length === 0) {
      lastError = `图床 ${provider.name} 未配置 API Key`;
      continue;
    }

    const keyManager = getProviderKeyManager(provider);
    const maxRetries = Math.min(3, keys.length);

    for (let i = 0; i < maxRetries; i++) {
      const apiKey = keyManager.getCurrentKey();
      if (!apiKey) {
        lastError = '所有 API Key 暂时不可用';
        break;
      }

      let result: UploadResult;
      try {
        result = await uploadWithProvider(provider, apiKey, imageData, options);
      } catch (error) {
        result = { success: false, error: error instanceof Error ? error.message : '上传失败' };
      }
      if (result.success) {
        return result;
      }

      lastError = result.error || '上传失败';
      keyManager.markCurrentKeyFailed();
    }
  }

  return { success: false, error: lastError };
}

/**
 * Check if any image host is configured
 */
export function isImageHostConfigured(): boolean {
  return useAPIConfigStore.getState().isImageHostConfigured();
}
