import mongoose from "mongoose"

const mediaSchema = new mongoose.Schema(
    {
        user:{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        url:{
            type: String,
            required: true
        },
        publicId:{
            type: String,
            required: true
        },
        originalName:{
            type: String
        },
        format: {
            type: String
        },
        size:{
            Type: Number
        },
        width: {
            type: Number
        },
        height: {
            type: Number
        }
    },
    { timestamps: true}
)

mediaSchema.index({ user: 1, createdAt: -1 })

export default mongoose.model("Media", mediaSchema)