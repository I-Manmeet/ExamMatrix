// Some networks (college Wi-Fi, Jio, some routers) block the DNS lookup that
// mongodb+srv:// needs → "querySrv ECONNREFUSED". Set DNS_SERVERS=8.8.8.8,1.1.1.1
// in .env to look it up through Google/Cloudflare DNS instead.
const dns = require("dns");
if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map(function (s) { return s.trim(); }).filter(Boolean));
}

const mongoose = require("mongoose");

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected");
}

module.exports = { connectDB };
