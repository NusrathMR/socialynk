import { publishPost } from "../services/publisherServices.js"

const run = async (label, post) => {
  console.log(`\n--- ${label} ---`)
  const result = await publishPost(post)
  console.log(result)
}

await run("1. All channels succeed", {
  _id: "test1",
  caption: "Hello world",
  platforms: ["instagram", "facebook", "linkedin"],
})

await run("2. Everything fails", {
  _id: "test2",
  caption: "Hello [fail]",
  platforms: ["instagram", "facebook"],
})

await run("3. Only Facebook fails", {
  _id: "test3",
  caption: "Hello [fail:facebook]",
  platforms: ["instagram", "facebook", "linkedin"],
})

await run("4. No channels", {
  _id: "test4",
  caption: "Hello",
  platforms: [],
})

await run("5. Unsupported channel", {
  _id: "test5",
  caption: "Hello",
  platforms: ["unsupported"],
})

await run("6. Retry only the failed one", {
  _id: "test6",
  caption: "Hello",
  platforms: ["instagram", "facebook"],
})

console.log("\n--- Retry with a smaller list ---")
console.log(
  await publishPost(
    { _id: "test7", caption: "Hello", platforms: ["instagram", "facebook", "linkedin"] },
    ["facebook"]
  )
)