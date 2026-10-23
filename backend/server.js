require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./config/db");
const { AppError, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());          // lets the frontend call the backend
app.use(express.json());  // reads JSON from requests

// Health check
app.get("/api/health", (req, res) => {
  res.json({ data: "ok" });
});

// Routes get added here later, e.g.
// app.use("/api/auth", require("./routes/auth"));

// Unknown /api paths
app.use("/api", (req, res, next) => {
  next(new AppError(404, "Route not found"));
});

// Must be last
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

connectDB()
  .then(() => {
    server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  });

module.exports = app;