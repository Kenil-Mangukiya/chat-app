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
            required : true
        }
    },{
        timestamps : true
    }
)

const message = mongoose.models?.message || mongoose.model("message", messageSchema)

export default message