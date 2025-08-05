import mongoose from "mongoose";

export async function connectToDatabase(): Promise<void> {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    console.error("❌ MONGODB_URI environment variable is required");
    console.error(
      "Please set up MongoDB Atlas and add your connection string to .env"
    );
    console.error("Visit: https://www.mongodb.com/atlas");
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      // MongoDB Atlas optimized connection options
      retryWrites: true,
      w: "majority",
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
    });
    console.log("✅ Connected to MongoDB Atlas");

    // Setup indexes on first connection
    await setupIndexes();
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB Atlas:", error);
    console.error("Please check your MONGODB_URI connection string");
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
