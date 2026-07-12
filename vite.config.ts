import net from "net";
import { defineConfig } from "vite";

const findAvailablePort = (port: number): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(port, () => probe.close(() => resolve(port)));
    probe.on("error", (err: NodeJS.ErrnoException) =>
      err.code === "EADDRINUSE" ? resolve(findAvailablePort(port + 1)) : reject(err)
    );
  });

export default defineConfig(async () => ({
  build: {
    emptyOutDir: true,
  },
  server: {
    hmr: {
      path: "/__vite_hmr",
      port: await findAvailablePort(24678),
    },
  },
}));
