import { connectDb } from "@/db/connect-db"
import groupModel from "@/model/group-model"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import { emitToUser } from "@/lib/socket-server"

export async function POST(req) {
  await connectDb()

  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const { name, avatarUrl } = await req.json()
  if (!name || !name.trim()) return response(400, { field: "name" }, "Group name is required", false)

  try {
    const group = await groupModel.create({
      name: name.trim(),
      ownerId: session.user._id,
      avatarUrl,
      members: [
        { userId: session.user._id, role: "owner" },
      ],
    })
    // Emit group creation event to the creator
    emitToUser(session.user._id, "group_created", group)
    
    // Return created group
    return response(200, { group }, "Group created", true)
  } catch (e) {
    // Duplicate key error from unique index on { ownerId, name }
    if (e?.code === 11000) {
      return response(409, { field: "name" }, "Group name already exists. Choose another name.", false)
    }
    return response(500, {}, e.message, false)
  }
}


