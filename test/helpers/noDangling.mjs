export default function noDangling(request) {
  return () => {
    const danglingConnections = request.closeAll();
    if (danglingConnections > 0) {
      throw new Error(`Found ${danglingConnections} dangling connection(s) after test`);
    }
  };
}
