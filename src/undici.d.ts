declare module 'undici' {
  export class Pool {
    constructor(url: string, options?: {
      connections?: number;
      pipelining?: number;
      connectTimeout?: number;
      headersTimeout?: number;
      bodyTimeout?: number;
    });
    request(options: {
      path: string;
      method: string;
      headers?: Record<string, string>;
      body?: string;
    }): Promise<{
      statusCode: number;
      body: AsyncIterable<Buffer>;
    }>;
    close(): Promise<void>;
  }

  export function fetch(
    input: string | URL,
    init?: RequestInit
  ): Promise<Response>;
}
