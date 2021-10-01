declare module 'superwstest' {
  import type { Server, ClientRequestArgs, IncomingMessage } from 'http';
  import type WebSocket from 'ws';
  import type { SuperTest, Test } from 'supertest';

  type JsonObject = { [member: string]: JsonValue };
  interface JsonArray extends Array<JsonValue> {}
  type JsonValue = JsonObject | JsonArray | string | number | boolean | null;

  export interface ReceivedMessage {
    data: Buffer;
    isBinary: boolean;
  }

  export interface WSChain extends Promise<WebSocket> {
    set(header: string, value: string): this;
    set(header: Record<string, string>): this;
    unset(header: string): this;

    send(message: any, options?: { mask?: boolean; binary?: boolean; compress?: boolean; fin?: boolean }): this;
    sendText(message: any): this;
    sendJson(message: JsonValue): this;
    sendBinary(message: Uint8Array | Buffer | ArrayBuffer | number[]): this;

    wait(milliseconds: number): this;
    exec(fn: (ws: WebSocket) => (Promise<void> | void)): this;

    expectMessage<T>(
      conversion: (received: ReceivedMessage) => T,
      expected?: T | null,
    ): this;

    expectMessage<T>(
      conversion: (received: ReceivedMessage) => T,
      test: (message: T) => (boolean | undefined),
    ): this;

    expectText(expected?: string | RegExp | ((message: string) => (boolean | undefined))): this;
    expectJson(expected?: JsonValue | ((message: any) => (boolean | undefined))): this;
    expectBinary(expected?: Uint8Array | Buffer | ArrayBuffer | number[] | ((message: Uint8Array) => (boolean | undefined))): this;

    close(code?: number, reason?: string): this;
    expectClosed(
      expectedCode?: number | null,
      expectedReason?: string | null,
    ): this;

    expectUpgrade(test: (upgradeResponse: IncomingMessage) => (boolean | undefined)): this;

    expectConnectionError(expectedCode?: number | null): Promise<WebSocket>;
  }

  export interface SuperWSTest extends SuperTest<Test> {
    ws(path: string, options?: WebSocket.ClientOptions | ClientRequestArgs): WSChain;
    ws(path: string, protocols?: string | string[], options?: WebSocket.ClientOptions | ClientRequestArgs): WSChain;
  }

  export interface RequestOptions {
    shutdownDelay?: number;
  }

  function request(
    app: Server | string,
    options?: RequestOptions,
  ): SuperWSTest;

  namespace request {
    function closeAll(): void;
  }

  export default request;
}
