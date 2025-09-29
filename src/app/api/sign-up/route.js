import { connectDb } from "@/db/connect-db"
import { sendEmail } from "@/Email/send-email"
import userModel from "@/model/user-model"
import { response } from "@/util/response"
import { addAiFriendToUser } from "@/util/add-ai-friend"
import bcrypt from "bcryptjs"

export async function POST(req,res)
{
    await connectDb()

    try
    {

    const {username,email,password,otp} = await req.json()
    console.table([username,email,password])

    const hashPassword = await bcrypt.hash(password,10)

    const createUser = await userModel.create({
        username,
        email,
        password : hashPassword,
        otp
    })

    console.log("Created user is : ",createUser)

    // Automatically add AI friend to the new user
    try {
        const aiFriendResult = await addAiFriendToUser(createUser._id);
        console.log("AI friend addition result:", aiFriendResult);
    } catch (error) {
        console.error("Failed to add AI friend during registration:", error);
        // Don't fail the registration if AI friend addition fails
    }

    return response(200,createUser,"User registered successfully",true);

    }
    catch(error)
    {
        console.log(error)
        return response(500,{},error.message,false)
    }

}