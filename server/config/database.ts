import mongoose from "mongoose";

export async function connectToDatabase(): Promise<void> {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    console.error(
      "❌ CRITICAL ERROR: MONGODB_URI environment variable is missing!"
    );
    console.error("");
    console.error("🔧 To fix this:");
    console.error("   1. Create a .env file in your project root");
    console.error("   2. Add: MONGODB_URI=your_mongodb_connection_string");
    console.error("   3. Get your connection string from MongoDB Atlas");
    console.error("");
    console.error("📚 Visit: https://www.mongodb.com/atlas");
    console.error(
      "💡 Example: MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database"
    );
    console.error("");
    process.exit(1);
  }

  // Validate MongoDB URI format
  if (
    !MONGODB_URI.startsWith("mongodb://") &&
    !MONGODB_URI.startsWith("mongodb+srv://")
  ) {
    console.error("❌ CRITICAL ERROR: Invalid MONGODB_URI format!");
    console.error("");
    console.error("🔧 Your MONGODB_URI must start with:");
    console.error("   - mongodb:// (for local MongoDB)");
    console.error("   - mongodb+srv:// (for MongoDB Atlas)");
    console.error("");
    console.error("💡 Current value:", MONGODB_URI);
    console.error("");
    process.exit(1);
  }

  try {
    console.log("🔌 Attempting to connect to MongoDB...");
    console.log(
      "📍 Connection string:",
      MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, "//***:***@")
    ); // Hide credentials

    await mongoose.connect(MONGODB_URI, {
      // MongoDB Atlas optimized connection options
      retryWrites: true,
      w: "majority",
      serverSelectionTimeoutMS: 15000, // 15 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 15000, // 15 seconds
      maxPoolSize: 10,
      minPoolSize: 1,
    });

    console.log("✅ Successfully connected to MongoDB!");
    console.log(`📊 Database: ${mongoose.connection.db.databaseName}`);
    console.log(
      `🔗 Connection state: ${
        mongoose.connection.readyState === 1 ? "Connected" : "Disconnected"
      }`
    );

    // Setup indexes on first connection
    await setupIndexes();
  } catch (error: any) {
    console.error("❌ CRITICAL ERROR: Failed to connect to MongoDB!");
    console.error("");
    
    if (error.name === 'MongoServerSelectionError') {
      console.error("🔧 This usually means:");
      console.error("   1. Your MongoDB Atlas cluster is not running");
      console.error("   2. Your IP address is not whitelisted");
      console.error("   3. Your username/password is incorrect");
      console.error("   4. Network connectivity issues");
      console.error("");
      console.error("💡 To fix:");
      console.error("   1. Check MongoDB Atlas dashboard");
      console.error("   2. Verify your IP is whitelisted");
      console.error("   3. Check your credentials");
      console.error("   4. Test network connectivity");
    } else if (error.name === 'MongoParseError') {
      console.error("🔧 This usually means:");
      console.error("   1. Invalid connection string format");
      console.error("   2. Missing database name");
      console.error("   3. Invalid authentication");
      console.error("");
      console.error("💡 Check your MONGODB_URI format");
    } else if (error.name === 'MongoNetworkError') {
      console.error("🔧 This usually means:");
      console.error("   1. Network connectivity issues");
      console.error("   2. Firewall blocking connection");
      console.error("   3. DNS resolution problems");
      console.error("");
      console.error("💡 To fix:");
      console.error("   1. Check your internet connection");
      console.error("   2. Try pinging the MongoDB host");
      console.error("   3. Check firewall settings");
    }
    
    console.error("");
    console.error("🔍 Technical details:");
    console.error("   Error name:", error.name);
    console.error("   Error message:", error.message);
    console.error("");
    console.error("🚫 Server startup failed. Please fix the database connection and try again.");
    process.exit(1);
  }
}

async function setupIndexes(): Promise<void> {
  try {
    // The indexes are defined in the schema, but we can ensure they're created
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db
        .listCollections()
        .toArray();
      console.log(
        `📊 Database collections: ${collections.map((c) => c.name).join(", ")}`
      );
    }
  } catch (error) {
    console.error("Failed to setup indexes:", error);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("Database connection closed.");
  process.exit(0);
});

export { mongoose };
