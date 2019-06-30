declare module 'superwstest' {
  import { Server } from 'http';
  import WebSocket from 'ws';
  import { SuperTest, Test } from 'supertest';

  interface WSChain extends Promise<WebSocket> {
    send(message: any): this;
    sendText(message: any): this;
    sendJson(message: string | object | number | null): this;

    wait(milliseconds: number): this;

    expectMessage<T>(
      conversion: (received: string) => T,
      expected?: T | null,
    ): this;

    expectMessage<T>(
      conversion: (received: string) => T,
      test: (message: T) => boolean,
    ): this;

    expectText(expected?: string | null): this;
    expectText(test: (message: string) => boolean): this;

    expectJson(expected?: string | null): this;
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

  export default function request(app: Server): SuperWSTest;
}
