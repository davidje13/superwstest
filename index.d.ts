declare module 'superwstest' {
  import { Server } from 'http';
  import WebSocket from 'ws';
  import { SuperTest, Test } from 'supertest';

  type JsonObject = { [member: string]: JsonValue };
  interface JsonArray extends Array<JsonValue> {}
  type JsonValue = JsonObject | JsonArray | string | number | boolean | null;

  interface WSChain extends Promise<WebSocket> {
    send(message: any): this;
    sendText(message: any): this;
    sendJson(message: JsonValue): this;

    wait(milliseconds: number): this;
    exec(fn: (ws: WebSocket) => (Promise<void> | void)): this;

    expectMessage<T>(
      conversion: (received: string) => T,
      expected?: T | null,
    ): this;

    expectMessage<T>(
      conversion: (received: string) => T,
      test: (message: T) => boolean,
    ): this;

    expectText(expected?: string): this;
    expectText(test: (message: string) => boolean): this;

    expectJson(expected?: JsonValue): this;
    expectJson(test: (message: any) => boolean): this;

    close(code?: number, message?: string): this;
    expectClosed(
      expectedCode?: number | null,
      expectedMessage?: string | null,
    ): this;

    expectConnectionError(expectedCode?: number | null): Promise<WebSocket>;
  }

  interface SuperWSTest extends SuperTest<Test> {
    ws: (path: string, options?: object) => WSChain;
  }

  interface RequestOptions {
    shutdownDelay?: number;
  }

  function request(
    app: Server,
    options?: RequestOptions,
  ): SuperWSTest;

  namespace request {
    function closeAll(): void;
  }

  export = request;
}
