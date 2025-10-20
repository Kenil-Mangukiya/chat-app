import mongoose from "mongoose"

const friendSchema = new mongoose.Schema({
    userid : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user"
    },
    friendid : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user"
    },
    friendusername : {
        type : String,
        required : true
    },
    friendemail : {
        type : String,
        required : true
    },
    friendprofilepicture : {
        type : String,
        default : null
    },
    isBlocked : {
        type : Boolean,
        default : false
    },
    blockedBy : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "user",
        default : null
    }
},
{
    timestamps : true
}
)

// Ensure a user cannot have duplicate friend entries for the same friend
friendSchema.index({ userid: 1, friendid: 1 }, { unique: true })

const friend = mongoose.models?.friend || mongoose.model("friend", friendSchema)

export default friend   