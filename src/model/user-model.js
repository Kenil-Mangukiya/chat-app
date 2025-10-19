import mongoose from "mongoose"

const userSchema = new mongoose.Schema(
    {
        username : {
            type : String,
            required : true,
            index : true
        },
        email : {
            type : String,
            required : true,
            index : true,
            lowerCase : true
        },
        password : {
            type : String,
            required : true
        },
        otp : {
            type : String
        },
        googleid : {
            type : String
        },
        profilePicture : {
            type : String
        },
        message : [
            {
                type : mongoose.Schema.Types.ObjectId,
                ref : "message"
            }
        ]
    },
    {
        timestamps : true
    }
)

const user = (mongoose.models?.user) || (mongoose.model("user",userSchema))

export default user
