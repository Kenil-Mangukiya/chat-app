import { connectDb } from "@/db/connect-db";
import friendModel from "@/model/friend-model";
import userModel from "@/model/user-model";
import mongoose from "mongoose";
import { response } from "@/util/response";

export async function POST(req,res)
{
    
    await connectDb()

    try
    {
        const {userId} = await req.json()

        // Find AI user in user model
        const findAiInUserModel = await userModel.findOne({email : "ai@gmail.com"})
        console.log("findAiInUserModel : ",findAiInUserModel)

        // Check if AI user exists
        if (!findAiInUserModel) {
            console.error("AI user not found in database");
            return response(404, {}, "AI user not found", false);
        }

        // Check if AI friend already exists for this user using the AI user's actual id
        const findAiInFriendModel = await friendModel.findOne({
            userid : new mongoose.Types.ObjectId(userId),
            friendid : new mongoose.Types.ObjectId(findAiInUserModel._id)
        })
        console.log("findAiInFriendModel : ",findAiInFriendModel)

        // If AI friend doesn't exist, add it
        if(!findAiInFriendModel)
        {
            const createAiFriend = await friendModel.create({
                userid : userId,
                friendid : findAiInUserModel._id,
                friendusername : findAiInUserModel.username,
                friendemail : findAiInUserModel.email,
                friendprofilepicture : findAiInUserModel.profilePicture
            })
            console.log("createAiFriend is : ",createAiFriend)

            console.log("Ai added in your friend list successfully")
        
            return response(200,{},"Ai added as a friend successfully",true)
        }
        else
        {
            return response(200,{},"Ai friend already exists",true)
        }
    }
    catch(error)
    {
        console.log("Error in add-ai-friend : ",error)
        
        return response(500,{},"",false)

    }

}