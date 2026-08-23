type ApiErrorBody = {
  error?: string;
  fields?: Record<string, string>;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly fields: Record<string, string> = {},
    public readonly status?: number,
  ) {
    super(message);
  }
}

export async function requestJson<T>(
  path: string,
  options: RequestInit | undefined,
  fallbackError: string,
): Promise<T> {
  let response: Response;
  let body: T & ApiErrorBody;

  try {
    response = await fetch(path, options);
  } catch {
    throw new ApiError(fallbackError);
  }

  try {
    body = (await response.json()) as T & ApiErrorBody;
  } catch {
    throw new ApiError(fallbackError);
  }

  if (!response.ok) {
    throw new ApiError(
      body.error ?? fallbackError,
      body.fields,
      response.status,
    );
  }

  return body;
}

export async function requestEmpty(
  path: string,
  options: RequestInit,
  fallbackError: string,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new ApiError(fallbackError);
  }

  if (response.ok) return;

  try {
    const body = (await response.json()) as ApiErrorBody;
    throw new ApiError(
      body.error ?? fallbackError,
      body.fields,
      response.status,
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(fallbackError, {}, response.status);
  }
}
