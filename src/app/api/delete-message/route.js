import { connectDb } from "@/db/connect-db"
import messageModel from "@/model/message-model"
import { response } from "@/util/response"
import mongoose from "mongoose"

export async function POST(req,res)
{
    const {id} = await req.json()

    try
    {
        
        await connectDb()
        const deleteMessage = await messageModel.findOneAndUpdate({_id : new mongoose.Types.ObjectId(id)},{
            content : "Message Deleted"
        },{
            new : true
        })
        console.log("deleteMessage : ",deleteMessage)
        return response(200,{},"Message deleted successfully",true)

    }
    catch(error)
    {
        console.log("Error while deleting message : ",error)
        return response(500,{},error,false)
    }

}