/** In-process request/response mocks so the handler can be tested without binding a port. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { RequestHandler } from '../../src/app.ts';

export interface MockResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  json: unknown;
}

export interface CallOptions {
  /** Sent as the JSON body (objects are stringified, strings are sent verbatim). */
  body?: unknown;
  headers?: Record<string, string>;
}

export function call(
  handler: RequestHandler,
  method: string,
  path: string,
  options: CallOptions = {},
): Promise<MockResponse> {
  const chunks: Buffer[] = [];
  if (options.body !== undefined) {
    const text = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    chunks.push(Buffer.from(text, 'utf8'));
  }
  const req = Object.assign(Readable.from(chunks), {
    method,
    url: path,
    headers: { host: 'localhost', 'content-type': 'application/json', ...options.headers },
  });
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    let body = '';
    const res = {
      statusCode: 200,
      headersSent: false,
      setHeader(name: string, value: string | number | readonly string[]): void {
        headers[name.toLowerCase()] = String(value);
      },
      getHeader(name: string): string | undefined {
        return headers[name.toLowerCase()];
      },
      end(chunk?: string | Buffer): void {
        if (chunk !== undefined) body += chunk.toString();
        res.headersSent = true;
        let json: unknown;
        try {
          json = body.length > 0 ? JSON.parse(body) : undefined;
        } catch {
          json = undefined;
        }
        resolve({ status: res.statusCode, headers, body, json });
      },
    };
    try {
      handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}
