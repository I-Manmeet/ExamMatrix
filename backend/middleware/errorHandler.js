// Use anywhere: throw new AppError(400, "Name is required")
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Every error replies in the same shape: { error: "message" }
function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }
  
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    error: status === 500 ? "Something went wrong" : err.message,
  });
}

module.exports = { AppError, errorHandler };