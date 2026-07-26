require("dotenv").config();
const app = require("./app");

process.on("uncaughtException", (error) => {
  console.error("[api] uncaughtException");
  console.error(error);
});

process.on("unhandledRejection", (reason) => {
  console.error("[api] unhandledRejection");
  console.error(reason);
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("[api] SIGTERM received, shutting down...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[api] SIGINT received, shutting down...");
  server.close(() => {
    process.exit(0);
  });
});