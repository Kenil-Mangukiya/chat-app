import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import groupModel from "@/model/group-model"

export async function GET() {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  const groups = await groupModel
    .find({ "members.userId": session.user._id })
    .sort({ updatedAt: -1 })

  return response(200, { groups }, "Groups fetched", true)
}


