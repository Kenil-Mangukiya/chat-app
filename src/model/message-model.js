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
        type: {
            type: String,
            enum: ["direct", "group"],
            default: "direct"
        }, 
        content : {
            type : String,
            required : false
        },
        messageType: {
            type: String,
            enum: ["text", "call", "attachment"],
            default: "text"
        },
        callData: {
            callType: {
                type: String,
                enum: ["voice", "video"],
                required: function() { return this.messageType === "call" }
            },
            duration: {
                type: Number, // Duration in seconds
                default: 0
            },
            status: {
                type: String,
                enum: ["missed", "answered", "declined", "ended"],
                default: "ended"
            },
            direction: {
                type: String,
                enum: ["incoming", "outgoing"],
                required: function() { return this.messageType === "call" }
            },
            roomId: {
                type: String,
                required: function() { return this.messageType === "call" }
            }
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