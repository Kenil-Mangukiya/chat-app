import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../auth/[...nextauth]/option"
import messageModel from "@/model/message-model"
import conversationModel from "@/model/conversation-model"

export async function POST(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { content, senderId, receiverId, timestamp, type, isSystemMessage, attachment } = await req.json()
  
  if (!content || !senderId || !receiverId) {
    return response(400, {}, "content, senderId, and receiverId are required", false)
  }

  try {
    // For system messages, we need to handle them differently
    if (isSystemMessage && type === 'system') {
      // Find or create conversation for system messages
      let conversation = await conversationModel.findOne({
        participants: { $all: [receiverId] },
        type: "group"
      })

      if (!conversation) {
        conversation = await conversationModel.create({
          participants: [receiverId],
          type: "group"
        })
      }

      // Create the system message
      const newMessage = await messageModel.create({
        conversationid: conversation._id,
        senderid: senderId,
        receiverid: receiverId,
        content: content,
        attachment: attachment || null,
        type: "system",
        isSystemMessage: true,
        createdAt: new Date(timestamp)
      })

      // Update conversation
      await conversationModel.findByIdAndUpdate(conversation._id, {
        lastmessage: newMessage._id,
        updatedat: Date.now(),
      })

      return response(200, { message: newMessage }, "System message stored", true)
    }

    return response(400, {}, "Invalid message type", false)
  } catch (e) {
    console.error("Error storing message:", e)
    return response(500, {}, e.message, false)
  }
}