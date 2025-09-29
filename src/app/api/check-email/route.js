import { connectDb } from "@/db/connect-db";
import userModel from "@/model/user-model";
import { response } from "@/util/response";

export async function POST(req)
{
    await connectDb()

    try
    {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const {email} = await req.json()
        console.log("Email is : ",email)
        const findUserByEmail = await userModel.findOne({email})
        if(email.length > 0 && !emailRegex.test(email))
        {
            return response(404,{},"Invalid email id",false)
        }
        if(findUserByEmail)
        {
            return response(200,{username : findUserByEmail.username},"User is already registered with above email id",false)
        }
        else
        {
            return response(200,{},"User can register with above email id",true)
        }
    }
    catch(error)
    {
        console.log("Error is : ",error)
        return response(500,{},"Internal server error",false)
    }
}