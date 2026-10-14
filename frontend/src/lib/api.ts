/**
 * Thin API client.
 *
 * The backend sets an httpOnly session cookie, so requests use
 * `credentials: 'include'` and never handle the token in JS. A Bearer header
 * is still sent when a token was returned by the login response, which keeps
 * the client usable for scripted tests.
 */

const BASE = '/api';

export interface ApiMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
  message?: string;
  temporaryPassword?: string;
}

export interface ApiFailure {
  success: false;
  code: string;
  message: string;
  fields?: Record<string, string>;
  details?: unknown;
  data?: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, body: ApiFailure) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fields = body.fields;
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, unknown>;
  /** Set for multipart uploads: the browser must set the boundary itself. */
  formData?: FormData;
}

function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.append(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : '';
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccess<T>> {
  const { method = 'GET', body, signal, query, formData } = options;

  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}${buildQuery(query)}`, {
    method,
    headers,
    credentials: 'include',
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
    signal,
  });

  const text = await res.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const failure: ApiFailure =
      (payload as ApiFailure | null) ?? {
        success: false,
        code: 'UNKNOWN',
        message: `Permintaan gagal (${res.status}).`,
      };
    throw new ApiError(res.status, failure);
  }

  return (payload ?? { success: true, data: null }) as ApiSuccess<T>;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData, query?: Record<string, unknown>) =>
    request<T>(path, { method: 'POST', formData, query }),
};

/** Triggers a browser download for an authenticated export endpoint. */
export async function downloadFile(
  path: string,
  query?: Record<string, unknown>,
  fallbackName = 'lumen-export.xlsx',
): Promise<void> {
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${BASE}${path}${buildQuery(query)}`, {
    credentials: 'include',
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = `Gagal mengunduh berkas (${res.status}).`;
    try {
      message = (JSON.parse(text) as ApiFailure).message;
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, { success: false, code: 'DOWNLOAD_FAILED', message });
  }

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? fallbackName;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
