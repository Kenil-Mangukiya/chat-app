import mongoose from "mongoose"

const messageSchema = new mongoose.Schema(
    {
        conversationid : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "conversation"
        },
        senderid : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "user"
        },
        receiverid : {
            type : mongoose.Schema.Types.ObjectId,
            ref : "user"
        }, 
        content : {
            type : String,
            required : false
        },
        attachment: {
            url: { type: String },
            publicId: { type: String },
            resourceType: { type: String, enum: ["image", "video", "raw"], default: undefined },
            format: { type: String },
            bytes: { type: Number },
            width: { type: Number },
            height: { type: Number },
            pageCount: { type: Number },
            originalFilename: { type: String },
            secureUrl: { type: String },
            thumbnailUrl: { type: String }
        }
    },{
        timestamps : true
    }
)

const message = mongoose.models?.message || mongoose.model("message", messageSchema)

export default message