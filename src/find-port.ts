import net from 'node:net';

/** Try to listen on `preferred`; if busy, let the OS pick a free port. */
export function findFreePort(preferred: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        const srv2 = net.createServer();
        srv2.listen(0, () => {
          const freePort = (srv2.address() as net.AddressInfo).port;
          srv2.close(() => resolve(freePort));
        });
        srv2.once('error', reject);
      } else {
        reject(err);
      }
    });
    srv.listen(preferred, () => {
      srv.close(() => resolve(preferred));
    });
  });
}
