import { sendEmail } from "@/Email/send-email";
import { response } from "@/util/response";

export async function POST(req)
{
    const {username,email,otp} = await req.json()
    console.table({username,email,otp})

    try
    {

        await sendEmail(username,email,otp)
        return response(200,{},"OTP sent successfully")

    }
    catch(error)
    {

        console.log("Error while sending otp : ",error)
        return response(500,{},error.message,false)

    }

}