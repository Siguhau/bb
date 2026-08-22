type ApiErrorBody = {
  error?: string
  fields?: Record<string, string>
}

export class ApiError extends Error {
  constructor(message: string, public readonly fields: Record<string, string> = {}) {
    super(message)
  }
}

export async function requestJson<T>(
  path: string,
  options: RequestInit | undefined,
  fallbackError: string,
): Promise<T> {
  let response: Response
  let body: T & ApiErrorBody

  try {
    response = await fetch(path, options)
  } catch {
    throw new ApiError(fallbackError)
  }

  try {
    body = await response.json() as T & ApiErrorBody
  } catch {
    throw new ApiError(fallbackError)
  }

  if (!response.ok) {
    throw new ApiError(body.error ?? fallbackError, body.fields)
  }

  return body
}
