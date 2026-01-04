import { useState, useEffect, useCallback } from 'react';

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: {
        maxRetries?: number;
        initialDelay?: number;
        maxDelay?: number;
        backoffFactor?: number;
        onRetry?: (error: Error, attempt: number) => void;
    } = {}
): Promise<T> {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        backoffFactor = 2,
        onRetry,
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            if (attempt === maxRetries) {
                throw lastError;
            }

            const delay = Math.min(
                initialDelay * Math.pow(backoffFactor, attempt),
                maxDelay
            );

            onRetry?.(lastError, attempt + 1);

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

/**
 * Hook for fetching data with automatic retry
 */
export function useFetchWithRetry<T>(
    fetchFn: () => Promise<T>,
    options: {
        maxRetries?: number;
        enabled?: boolean;
        onSuccess?: (data: T) => void;
        onError?: (error: Error) => void;
    } = {}
) {
    const { maxRetries = 3, enabled = true, onSuccess, onError } = options;

    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    const execute = useCallback(async () => {
        if (!enabled) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await retryWithBackoff(fetchFn, {
                maxRetries,
                onRetry: (_, attempt) => setRetryCount(attempt),
            });

            setData(result);
            setRetryCount(0);
            onSuccess?.(result);
        } catch (err) {
            const error = err as Error;
            setError(error);
            onError?.(error);
        } finally {
            setIsLoading(false);
        }
    }, [fetchFn, maxRetries, enabled, onSuccess, onError]);

    const retry = useCallback(() => {
        execute();
    }, [execute]);

    useEffect(() => {
        execute();
    }, [execute]);

    return { data, isLoading, error, retryCount, retry };
}

/**
 * Fetch wrapper with built-in retry logic
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit & { maxRetries?: number } = {}
): Promise<Response> {
    const { maxRetries = 3, ...fetchOptions } = options;

    return retryWithBackoff(
        async () => {
            const response = await fetch(url, fetchOptions);

            // Retry on server errors (5xx) but not client errors (4xx)
            if (response.status >= 500) {
                throw new Error(`Server error: ${response.status}`);
            }

            return response;
        },
        { maxRetries }
    );
}

export default retryWithBackoff;
