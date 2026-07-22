import type { NextRequest } from 'next/server'
import type { HTTPAdapter } from '@x402/core/server'

// Wraps a Next.js Route Handler's NextRequest to satisfy @x402/core's
// framework-agnostic HTTPAdapter interface.
export class NextHTTPAdapter implements HTTPAdapter {
  private body: unknown

  constructor(private request: NextRequest, parsedBody: unknown) {
    this.body = parsedBody
  }

  getHeader(name: string): string | undefined {
    return this.request.headers.get(name) || undefined
  }

  getMethod(): string {
    return this.request.method
  }

  getPath(): string {
    return this.request.nextUrl.pathname
  }

  getUrl(): string {
    return this.request.url
  }

  getAcceptHeader(): string {
    return this.request.headers.get('accept') || ''
  }

  getUserAgent(): string {
    return this.request.headers.get('user-agent') || ''
  }

  getQueryParams(): Record<string, string | string[]> {
    const params: Record<string, string | string[]> = {}
    for (const [key, value] of this.request.nextUrl.searchParams.entries()) {
      params[key] = value
    }
    return params
  }

  getQueryParam(name: string): string | undefined {
    return this.request.nextUrl.searchParams.get(name) || undefined
  }

  getBody(): unknown {
    return this.body
  }
}

// Reads the payment header the core server looks for. x402 clients send it
// as PAYMENT-SIGNATURE (matching this app's existing convention) — the core
// library itself is header-name-agnostic and expects the caller to extract it.
export async function buildRequestContext(request: NextRequest, path: string) {
  let parsedBody: unknown = undefined
  try {
    if (request.headers.get('content-type')?.includes('application/json')) {
      const text = await request.text()
      parsedBody = text ? JSON.parse(text) : undefined
    }
  } catch {
    parsedBody = undefined
  }

  const adapter = new NextHTTPAdapter(request, parsedBody)
  const paymentHeader = request.headers.get('payment-signature') || request.headers.get('x-payment') || undefined

  return {
    adapter,
    path,
    method: request.method,
    paymentHeader,
  }
}
