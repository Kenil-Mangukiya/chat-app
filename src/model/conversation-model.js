import mongoose from "mongoose";
import { date } from "zod";

const conversationSchema = new mongoose.Schema({
    participants : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : "user"
        }
    ],
    lastmessage : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "message"
    },
    updatedat : {
        type : Date,
        default : Date.now()
    },
    // Store cleared state for each user
    clearedFor: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
},{timestamps : true})

const conversation = mongoose.models?.conversation || mongoose.model("conversation", conversationSchema)

export default conversation