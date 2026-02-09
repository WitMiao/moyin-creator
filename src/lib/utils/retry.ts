// Copyright (c) 2025 hotflow2024
// Licensed under AGPL-3.0-or-later. See LICENSE for details.
// Commercial licensing available. See COMMERCIAL_LICENSE.md.
/**
 * Retry utility with exponential backoff
 * Based on CineGen-AI geminiService.ts retryOperation
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (attempt: number, delay: number, error: Error) => void;
}

/**
 * Check if an error is a rate limit error (429 or quota exceeded)
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error) return false;
  
  const err = error as any;
  
  // Check status code
  if (err.status === 429 || err.code === 429) return true;
  
  // Check error message
  const message = err.message?.toLowerCase() || "";
  if (
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("rate") ||
    message.includes("resource_exhausted") ||
    message.includes("too many requests")
  ) {
    return true;
  }
  
  return false;
}

/**
 * Retry an async operation with exponential backoff for rate limit errors
 * 
 * @param operation - The async operation to retry
 * @param options - Retry configuration
 * @returns The result of the operation
 * @throws The last error if all retries fail
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 2000, onRetry } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Only retry on rate limit errors
      if (!isRateLimitError(error)) {
        throw error;
      }
      
      // Check if we have more retries left
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        
        if (onRetry) {
          onRetry(attempt + 1, delay, lastError);
        } else {
          console.warn(
            `[Retry] Rate limit hit, retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`
          );
        }
        
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Wrap an async function with retry logic
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: Parameters<T>) => retryOperation(() => fn(...args), options)) as T;
}
