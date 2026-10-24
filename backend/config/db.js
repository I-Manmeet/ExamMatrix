const mongoose = require("mongoose");

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected");
}

module.exports = { connectDB };


// const mongoose = require("mongoose");

// async function connectDB() {
//   console.log("Connecting to MongoDB...");

//   try {
//     await mongoose.connect(process.env.MONGO_URI, {
//       serverSelectionTimeoutMS: 10000
//     });

//     console.log("MongoDB connected");
//   } catch (error) {
//     console.error("DB connection failed:", error.message);
//     throw error;
//   }
// }

// module.exports = { connectDB };