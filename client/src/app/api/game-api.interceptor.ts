import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { SaveTokenStore } from '../session/save-token-store';

/**
 * Adds `Accept-Language` to API calls, and the save token — only as a header, never in a URL —
 * to calls that act on the current save (`/api/save/**`).
 */
export const gameApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);

  const headers: Record<string, string> = {
    'Accept-Language': inject(TranslocoService).getActiveLang(),
  };
  const token = inject(SaveTokenStore).get();
  if (request.url.startsWith('/api/save/') && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return next(request.clone({ setHeaders: headers }));
};
