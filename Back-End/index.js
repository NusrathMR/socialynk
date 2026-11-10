import express from "express"
import "dotenv/config"
import bodyParser from "body-parser"
import connectDb from "./config/db.js"
import userRoute from "./routes/userRoute.js"
import cors from "cors"
import postRoute from "./routes/postRoute.js"
import { startScheduler } from "./services/schedulerService.js"
import aiRoute from "./routes/aiRoute.js"
import mediaRoute from "./routes/mediaRoute.js"
import adminUserRoute from "./routes/adminUserRoute.js"
import adminDashboardRoute from "./routes/adminDashboardRoute.js"
import adminSettingsRoute from "./routes/adminSettingsRoute.js"
import brandMemoryRoute from "./routes/brandMemoryRoute.js"
import {corsOptions} from "./config/corsConfig.js"



const app = express()
const PORT = process.env.PORT || 8000

connectDb()
startScheduler()

app.use(bodyParser.json())
app.use(cors(corsOptions))

app.use("/api/user", userRoute)
app.use("/api/posts", postRoute)
app.use("/api/ai", aiRoute)
app.use("/api/media", mediaRoute)
app.use("/api/admin/users", adminUserRoute)
app.use("/api/admin/dashboard", adminDashboardRoute)
app.use("/api/admin/settings", adminSettingsRoute)
app.use("/api/brand-memory", brandMemoryRoute)


app.listen(PORT, ()=>{
    console.log(`The server is running through http://localhost:${PORT}/`)
})