import { connectDb } from "@/db/connect-db"
import messageModel from "@/model/message-model"
import { response } from "@/util/response"
import { getServerSession } from "next-auth/next"
import { authOption } from "../auth/[...nextauth]/option"
import { emitToUser } from "@/lib/socket-server"

export async function PUT(req) {
    await connectDb()

    try {
        // Get the current session
        const session = await getServerSession(authOption)
        
        if (!session?.user?._id) {
            return response(401, {}, "Unauthorized", false)
        }

        const { senderId } = await req.json()
        
        if (!senderId) {
            return response(400, {}, "Sender ID is required", false)
        }

        // Mark all messages from the sender as read
        const result = await messageModel.updateMany(
            { 
                senderid: senderId, 
                receiverid: session.user._id,
                readStatus: { $ne: { isRead: true } }
            },
            { 
                $set: { 
                    "readStatus.isRead": true,
                    "readStatus.readAt": new Date()
                }
            }
        )

        // Notify the sender that their messages have been read
        if (result.modifiedCount > 0) {
            emitToUser(senderId, "messages_read", {
                receiverId: session.user._id,
                readCount: result.modifiedCount
            })
        }

        return response(200, { 
            modifiedCount: result.modifiedCount 
        }, "Messages marked as read", true)

    } catch (error) {
        console.error('Error marking messages as read:', error)
        return response(500, {}, error.message, false)
    }
}