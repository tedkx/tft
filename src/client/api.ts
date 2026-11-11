export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers,
  });
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error ?? `HTTP ${response.status}`);
  return data as T;
}
