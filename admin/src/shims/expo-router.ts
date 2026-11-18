'use client';

// The shared KeyGo screens were written against expo-router. In the portal these hooks are backed by next/navigation.
import { useParams, useRouter as useNextRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export function useRouter() {
  const router = useNextRouter();
  return useMemo(
    () => ({
      push: (href: string) => router.push(href),
      replace: (href: string) => router.replace(href),
      navigate: (href: string) => router.push(href),
      back: () => router.back(),
      canGoBack: () => typeof window !== 'undefined' && window.history.length > 1,
    }),
    [router]
  );
}

export function useLocalSearchParams<T extends Record<string, string | undefined>>(): T {
  const params = useParams();
  const search = useSearchParams();
  return useMemo(() => {
    const merged: Record<string, string> = {};
    search.forEach((value, key) => {
      merged[key] = value;
    });
    Object.entries(params ?? {}).forEach(([key, value]) => {
      merged[key] = Array.isArray(value) ? value.join('/') : (value ?? '');
    });
    return merged as T;
  }, [params, search]);
}
