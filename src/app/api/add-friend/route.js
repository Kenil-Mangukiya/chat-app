import { connectDb } from "@/db/connect-db"
import friendModel from "@/model/friend-model"
import userModel from "@/model/user-model"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"

export async function POST(req)
{
    await connectDb()

    const session = await getServerSession(authOptions)

    if(!session)
    {
        return response(403,{},"Not authorized",false)
    }   

    console.log("Session data is : ",session)

    const {email} = await req.json()

    const findUserByEmail = await userModel.findOne({email})

    console.log("findUserByEmail is : ",findUserByEmail)

    if(!findUserByEmail)
    {
        return response(404,{},"No user found",false)
    }

    const findUserInFriendModel = await friendModel.findOne({friendemail : email})

    if(findUserByEmail?._id == session.user._id)
    {
        return response(403,{},"You can't add your self as a friend",false)
    }

    if(findUserInFriendModel)
    {
        return response(401,{},"User is already added in your friend list")
    }

    

    const addFriend = await friendModel.create({
        userid : session.user._id,
        friendid : findUserByEmail._id,
        friendusername : findUserByEmail.username,
        friendemail : findUserByEmail.email,
        friendprofilepicture : findUserByEmail.profilePicture
    })

    const addFriendInFriend = await friendModel.create({
        userid : findUserByEmail._id,
        friendid : session.user._id,
        friendusername : session.user.username,
        friendemail : session.user.email,
        friendprofilepicture : session.user.profilePicture
    })

    return response(200,{},"Friend added successfully",true)

}