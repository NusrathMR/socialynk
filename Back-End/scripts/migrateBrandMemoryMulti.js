import "dotenv/config"
import dns from "node:dns"
import mongoose from "mongoose"
import BrandMemory from "../models/brandMemoryModel.js"
import User from "../models/userModel.js"

dns.setServers(["8.8.8.8", "8.8.4.4"])

async function migrateBrandMemories() {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is required to run this migration.")
  }

  await mongoose.connect(process.env.MONGO_URL, { autoIndex: false })

  const database = mongoose.connection.db
  const collection = BrandMemory.collection
  const collectionExists = await database
    .listCollections({ name: collection.collectionName })
    .hasNext()

  if (!collectionExists) {
    await collection.createCollection()
  }

  const memoryCountBefore = await collection.countDocuments({})
  let indexes = await collection.indexes()
  const uniqueUserIndexes = indexes.filter((index) =>
    index.unique &&
    Object.keys(index.key).length === 1 &&
    index.key.user === 1
  )
  const removedIndexNames = []

  for (const index of uniqueUserIndexes) {
    await collection.dropIndex(index.name)
    removedIndexNames.push(index.name)
  }

  indexes = await collection.indexes()
  const remainingUniqueUserIndexes = indexes.filter((index) =>
    index.unique &&
    Object.keys(index.key).length === 1 &&
    index.key.user === 1
  )

  if (remainingUniqueUserIndexes.length > 0) {
    throw new Error("A unique BrandMemory user index remains after migration.")
  }

  const hasUserIndex = indexes.some((index) =>
    Object.keys(index.key).length === 1 &&
    index.key.user === 1
  )

  if (!hasUserIndex) {
    await collection.createIndex({ user: 1 }, { name: "user_1" })
  }

  const memories = await collection
    .find({ user: { $type: "objectId" } }, { projection: { _id: 1, user: 1, updatedAt: 1 } })
    .sort({ updatedAt: -1, _id: 1 })
    .toArray()
  const newestMemoryByUser = new Map()

  for (const memory of memories) {
    const userId = String(memory.user)
    if (!newestMemoryByUser.has(userId)) {
      newestMemoryByUser.set(userId, memory._id)
    }
  }

  let activeReferencesUpdated = 0
  const users = await User.collection.find(
    {},
    { projection: { _id: 1, activeBrandMemory: 1 } }
  ).toArray()

  for (const user of users) {
    const activeId = user.activeBrandMemory
    const activeMemory = activeId
      ? await collection.findOne({ _id: activeId, user: user._id }, { projection: { _id: 1 } })
      : null

    if (activeMemory) continue

    const fallbackMemoryId = newestMemoryByUser.get(String(user._id)) || null
    if (activeId === fallbackMemoryId) continue

    await User.collection.updateOne(
      { _id: user._id },
      { $set: { activeBrandMemory: fallbackMemoryId } }
    )
    activeReferencesUpdated += 1
  }

  const memoryCountAfter = await collection.countDocuments({})
  if (memoryCountAfter !== memoryCountBefore) {
    throw new Error("Brand Memory document count changed during migration.")
  }

  console.log(
    `Brand Memory migration complete: removed ${removedIndexNames.join(", ") || "no legacy unique indexes"}; ` +
    `verified no unique user index remains; preserved ${memoryCountAfter} memory record(s); ` +
    `updated ${activeReferencesUpdated} invalid active reference(s).`
  )
}

try {
  await migrateBrandMemories()
} catch (error) {
  console.error("Brand Memory migration failed:", error.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
