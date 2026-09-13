import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { seedAdmin } from "./services/auth.service.js";
import { seedDefaultCategories } from "./services/category.service.js";

const startServer = async () => {
  await connectDatabase();
  if (env.mongodbUri) {
    await seedAdmin();
    await seedDefaultCategories();
  }
  app.listen(env.port, () => {
    console.log(`Sukh Breeze API listening on port ${env.port}`);
  });
};

startServer().catch((error) => {
  console.error("Unable to start server", error);
  process.exit(1);
});
