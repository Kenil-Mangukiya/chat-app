import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import groupModel from "@/model/group-model"
import messageModel from "@/model/message-model"
import conversationModel from "@/model/conversation-model"
import { emitToUser } from "@/lib/socket-server"

export async function POST(req) {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { groupId, content, attachment } = await req.json()
  if (!groupId || (!content && !attachment)) return response(400, {}, "groupId and content or attachment required", false)

  const group = await groupModel.findById(groupId)
  if (!group) return response(404, {}, "Group not found", false)

  // Check if user is a member of the group
  const isMember = group.members.some(member => member.userId.toString() === session.user._id)
  if (!isMember) return response(403, {}, "Not a member of this group", false)

  try {
    // Create or find conversation for the group
    let conversation = await conversationModel.findOne({
      participants: { $all: [groupId] },
      type: "group"
    })

    if (!conversation) {
      conversation = await conversationModel.create({
        participants: [groupId],
        type: "group"
      })
    }

    // Create the message
    const newMessage = await messageModel.create({
      conversationid: conversation._id,
      senderid: session.user._id,
      receiverid: groupId,
      content: content || '',
      attachment: attachment || null,
      type: "group"
    })

    // Update conversation
    await conversationModel.findByIdAndUpdate(conversation._id, {
      lastmessage: newMessage._id,
      updatedat: Date.now(),
    })

    // Emit to all group members
    console.log("Group members:", group.members.map(m => m.userId.toString()));
    console.log("Current user:", session.user._id);
    
    group.members.forEach(member => {
      if (member.userId.toString() !== session.user._id) {
        console.log(`Sending notification to member: ${member.userId}`);
        
        emitToUser(member.userId, "group_message_received", {
          message: newMessage,
          groupId,
          senderName: session.user.username
        })
        
        // Emit new_message directly for notification system
        const notificationContent = content || (attachment ? 'Sent a file' : '');
        console.log(`Sending new_message to ${member.userId} with content: ${notificationContent}`);
        
        emitToUser(member.userId, "new_message", {
          content: notificationContent,
          receiverId: member.userId,
          senderId: `group_${groupId}`
        })
      }
    })

    return response(200, { message: newMessage }, "Message sent", true)
  } catch (e) {
    return response(500, {}, e.message, false)
  }
}
