import { connectDb } from "@/db/connect-db"
import { response } from "@/util/response"
import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import groupModel from "@/model/group-model"
import mongoose from "mongoose"

export async function GET() {
  await connectDb()
  const session = await getServerSession(authOptions)
  if (!session) return response(403, {}, "Not authorized", false)

  // Convert userId to ObjectId to ensure proper database query
  const userObjectId = new mongoose.Types.ObjectId(session.user._id)
  
  const groups = await groupModel
    .find({ "members.userId": userObjectId })
    .populate('ownerId', 'username email profilePicture')
    .populate('members.userId', 'username email profilePicture')
    .sort({ updatedAt: -1 })

  return response(200, { groups }, "Groups fetched", true)
}


