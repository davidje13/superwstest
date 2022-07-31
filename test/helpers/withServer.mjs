export default function withServer(serverFactory, address = 'localhost') {
  return beforeEach(async ({ setParameter }) => {
    const server = await serverFactory();
    setParameter(server);
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
