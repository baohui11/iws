'use client'

export async function fetchJsonOrThrow<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, {
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  })

  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }

  return (await res.json()) as T
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string }
    if (body.message?.trim()) return body.message
    if (body.error?.trim()) return body.error
  } catch {
    /* ignore */
  }
  return `请求失败（${res.status}）`
}
