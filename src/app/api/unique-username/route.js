import { connectDb } from "@/db/connect-db"
import userModel from "@/model/user-model"
import { usernameValidation } from "@/schema/sign-up-schema"
import { response } from "@/util/response"
import {z} from "zod"

const usernameQuerySchema = z.object({
    username : usernameValidation
})

export async function POST(req)
{
    await connectDb()

    try
    {

    const {searchParams} = new URL(req.url)

    const getUsername = {
        username : searchParams.get("username")
    }

    const result = usernameQuerySchema.safeParse(getUsername)

    // console.log("Result error is : ",result?.error)

    if(!result.success)
    {
        const usernameError = result.error.format().username?._errors || []
        return response(400,{},usernameError.length > 0 ? usernameError.join(", ") : "Username is not available",false)
    }

    const {username} = result.data

    const findUserByUsername = await userModel.findOne({username})

    if(findUserByUsername)
    {
        return response(403,{},"Username is not available",false)
    }
    else
    {
        return response(200,{},"Username is available",true)
    }

    }
    catch(error)
    {

        return response(500,{},error.message,false)

    }

}