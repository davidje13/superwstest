export default function runServer(server, address = 'localhost') {
  return async () => {
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
  };
}
