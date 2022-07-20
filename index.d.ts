declare module 'superwstest' {
  import type { Server } from 'net';
  import type { ClientRequestArgs, IncomingMessage } from 'http';
  import type { WebSocket, ClientOptions, WebSocketServer } from 'ws';
  import type { SuperTest, Test } from 'supertest';

  type JsonObject = { [member: string]: JsonValue };
  interface JsonArray extends Array<JsonValue> {}
  type JsonValue = JsonObject | JsonArray | string | number | boolean | null;

  export interface ReceivedMessage {
    data: Buffer;
    isBinary: boolean;
  }

  export interface ExpectMessageOptions {
    timeout?: number | undefined;
  }

  export interface RequestOptions {
    shutdownDelay?: number | undefined;
    defaultExpectOptions?: ExpectMessageOptions | undefined;
  }

  export interface WSChain extends Promise<WebSocket> {
    set(header: string, value: string): this;
    set(header: Record<string, string>): this;
    unset(header: string): this;

    send(
      message: any,
      options?:
        | {
            mask?: boolean | undefined;
            binary?: boolean | undefined;
            compress?: boolean | undefined;
            fin?: boolean | undefined;
          }
        | undefined,
    ): this;
    sendText(message: any): this;
    sendJson(message: JsonValue): this;
    sendBinary(message: Uint8Array | Buffer | ArrayBuffer | number[]): this;

    wait(milliseconds: number): this;
    exec(fn: (ws: WebSocket) => Promise<unknown> | void): this;

    expectMessage<T>(
      conversion: (received: ReceivedMessage) => T,
      expected?: T | ((message: T) => boolean | void) | null | undefined,
      options?: ExpectMessageOptions | undefined,
    ): this;

    expectText(
      expected?: string | RegExp | ((message: string) => boolean | void) | undefined,
      options?: ExpectMessageOptions | undefined,
    ): this;

    expectJson(
      expected?: JsonValue | ((message: any) => boolean | void) | undefined,
      options?: ExpectMessageOptions | undefined,
    ): this;

    expectBinary(
      expected?:
        | Uint8Array
        | Buffer
        | ArrayBuffer
        | number[]
        | ((message: Uint8Array) => boolean | void)
        | undefined,
      options?: ExpectMessageOptions | undefined,
    ): this;

    close(code?: number | undefined, reason?: string | undefined): this;
    expectClosed(
      expectedCode?: number | null | undefined,
      expectedReason?: string | null | undefined,
    ): this;

    expectUpgrade(test: (upgradeResponse: IncomingMessage) => boolean | void): this;

    expectConnectionError(expectedCode?: number | string | null | undefined): Promise<WebSocket>;
  }

  export interface SuperWSTest extends SuperTest<Test> {
    ws(path: string, options?: ClientOptions | ClientRequestArgs | undefined): WSChain;
    ws(
      path: string,
      protocols?: string | string[] | undefined,
      options?: ClientOptions | ClientRequestArgs | undefined,
    ): WSChain;
  }

  interface SuperWSRequest {
    (app: Server | WebSocketServer | string, options?: RequestOptions | undefined): SuperWSTest;
    scoped(): SuperWSRequest;
    closeAll(): void;
  }

  const request: SuperWSRequest;
  export default request;
}
