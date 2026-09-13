import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { seedAdmin } from "./services/auth.service.js";

const startServer = async () => {
  await connectDatabase();
  if (env.mongodbUri) await seedAdmin();
  app.listen(env.port, () => {
    console.log(`Sukh Breeze API listening on port ${env.port}`);
  });
};

startServer().catch((error) => {
  console.error("Unable to start server", error);
  process.exit(1);
});
