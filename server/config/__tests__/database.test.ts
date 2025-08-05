import mongoose from "mongoose";
import { getTestDatabase } from "../../../tests/setup.js";

describe("Database Configuration", () => {
  it("should have test database connection", () => {
    const db = getTestDatabase();
    expect(db).toBeDefined();
    expect(db.readyState).toBe(1); // Connected
  });

  it("should be connected to in-memory database", () => {
    const db = getTestDatabase();
    expect(db.name).toMatch(/test/); // Should contain 'test' in name
  });

  it("should be able to create and query collections", async () => {
    const db = getTestDatabase();

    // Create a test collection
    const testCollection = db.collection("test-collection");

    // Insert a document
    await testCollection.insertOne({ test: "data", timestamp: new Date() });

    // Query the document
    const result = await testCollection.findOne({ test: "data" });

    expect(result).toBeDefined();
    expect(result?.test).toBe("data");

    // Clean up
    await testCollection.drop();
  });

  it("should handle mongoose operations", async () => {
    // Define a simple test schema
    const testSchema = new mongoose.Schema({
      name: { type: String, required: true },
      value: { type: Number, default: 0 },
      createdAt: { type: Date, default: Date.now },
    });

    const TestModel = mongoose.model("TestItem", testSchema);

    // Create a document
    const testItem = new TestModel({ name: "test-item", value: 42 });
    await testItem.save();

    // Query the document
    const foundItem = await TestModel.findOne({ name: "test-item" });

    expect(foundItem).toBeDefined();
    expect(foundItem?.name).toBe("test-item");
    expect(foundItem?.value).toBe(42);

    // Update the document
    await TestModel.updateOne({ name: "test-item" }, { value: 100 });

    const updatedItem = await TestModel.findOne({ name: "test-item" });
    expect(updatedItem?.value).toBe(100);

    // Delete the document
    await TestModel.deleteOne({ name: "test-item" });

    const deletedItem = await TestModel.findOne({ name: "test-item" });
    expect(deletedItem).toBeNull();
  });

  it("should handle validation errors", async () => {
    const testSchema = new mongoose.Schema({
      requiredField: { type: String, required: true },
      enumField: {
        type: String,
        enum: ["option1", "option2", "option3"],
        required: true,
      },
    });

    const TestModel = mongoose.model("ValidationTest", testSchema);

    // Test missing required field
    const invalidItem1 = new TestModel({ enumField: "option1" });
    await expect(invalidItem1.save()).rejects.toThrow("requiredField");

    // Test invalid enum value
    const invalidItem2 = new TestModel({
      requiredField: "test",
      enumField: "invalid-option",
    });
    await expect(invalidItem2.save()).rejects.toThrow();

    // Test valid item
    const validItem = new TestModel({
      requiredField: "test",
      enumField: "option1",
    });
    await expect(validItem.save()).resolves.toBeDefined();
  });
});
