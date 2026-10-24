require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const { connectDB } = require("./config/db");
const { AppError, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Middleware
app.use(helmet());                         // security headers on every reply
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "100kb" })); // refuse huge request bodies

// Health check
app.get("/api/health", (req, res) => {
  res.json({ data: "ok" });
});

// Routes
app.use("/api/universities", require("./routes/universities"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/halls", require("./routes/halls"));

// Unknown API routes
app.use("/api", (req, res, next) => {
  next(new AppError(404, "Route not found"));
});

// Error handler (must stay last)
app.use(errorHandler);

const PORT = process.env.PORT || 5001;     // 5000 is taken by AirPlay on Mac
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