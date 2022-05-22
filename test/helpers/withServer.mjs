export default function withServer(serverFactory, address = 'localhost') {
  beforeEach(async ({ addTestParameter }) => {
    const server = await serverFactory();
    addTestParameter(server);
    await new Promise((resolve, reject) => {
      server.listen(0, address, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    return () => new Promise((resolve) => server.close(resolve));
  });
}
