import cluster from "node:cluster";
import os from "node:os";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

const workers = os.cpus().length;
if (cluster.isPrimary) {
  for (let index = 0; index < workers; index += 1) cluster.fork();
  cluster.on("exit", (worker) => {
    if (!worker.exitedAfterDisconnect) cluster.fork();
  });
} else {
  await connectDatabase();
  app.listen(env.port, "127.0.0.1", () => {
    console.log(`Cluster worker ${process.pid} listening on ${env.port}`);
  });
}
