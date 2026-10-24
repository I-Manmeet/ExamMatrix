
require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");

const { connectDB } = require("./config/db");
const { AppError, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Middleware
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ data: "ok" });
});

// Hall routes
app.use("/api/Hall", require("./routes/Hall"));

// Unknown API routes
app.use("/api", (req, res, next) => {
  next(new AppError(404, "Route not found"));
});

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

connectDB()
  .then(() => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  });

module.exports = app;
