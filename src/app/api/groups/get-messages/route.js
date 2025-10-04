import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import groupModel from "@/model/group-model"
import messageModel from "@/model/message-model"
import conversationModel from "@/model/conversation-model"

export async function GET(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { searchParams } = new URL(req.url)
  const groupId = searchParams.get('groupId')
  
  if (!groupId) return response(400, {}, "groupId required", false)

  const group = await groupModel.findById(groupId)
  if (!group) return response(404, {}, "Group not found", false)

  // Check if user is a member of the group
  const isMember = group.members.some(member => member.userId.toString() === session.user._id)
  if (!isMember) return response(403, {}, "Not a member of this group", false)

  try {
    // Find conversation for the group
    const conversation = await conversationModel.findOne({
      participants: { $all: [groupId] },
      type: "group"
    })

    if (!conversation) {
      return response(200, { messages: [] }, "No messages found", true)
    }

    // Get messages
    const messages = await messageModel
      .find({ conversationid: conversation._id })
      .sort({ createdAt: 1 })

    return response(200, { messages }, "Messages fetched", true)
  } catch (e) {
    return response(500, {}, e.message, false)
  }
}
