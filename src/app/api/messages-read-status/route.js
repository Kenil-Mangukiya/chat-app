import { connectDb } from "@/db/connect-db"
import messageModel from "@/model/message-model"
import { response } from "@/util/response"
import { getServerSession } from "next-auth/next"
import { authOption } from "../auth/[...nextauth]/option"

export async function GET(req) {
    await connectDb()

    try {
        // Get the current session
        const session = await getServerSession(authOption)
        
        if (!session?.user?._id) {
            return response(401, {}, "Unauthorized", false)
        }

        const { searchParams } = new URL(req.url)
        const senderId = searchParams.get('senderId')
        const receiverId = searchParams.get('receiverId')
        
        if (!senderId || !receiverId) {
            return response(400, {}, "Sender ID and Receiver ID are required", false)
        }

        // Get all messages that have been read between these users
        const readMessages = await messageModel.find({
            senderid: senderId,
            receiverid: receiverId,
            "readStatus.isRead": true
        }).select('_id readStatus createdAt')

        return response(200, { 
            readMessages: readMessages,
            count: readMessages.length
        }, "Read status loaded successfully", true)

    } catch (error) {
        console.error('Error loading read status:', error)
        return response(500, {}, error.message, false)
    }
}
