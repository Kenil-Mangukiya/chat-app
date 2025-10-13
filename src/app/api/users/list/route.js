import { getServerSession } from "next-auth"
import { authOption as authOptions } from "../../auth/[...nextauth]/option"
import { response } from "@/util/response"
import { connectDb } from "@/db/connect-db"
import User from "@/model/user-model"
import Friend from "@/model/friend-model"
import FriendRequest from "@/model/friend-request-model"

export async function GET(req) {
  try {
    console.log('Users list API called')
    const session = await getServerSession(authOptions)
    if (!session) {
      console.log('No session found')
      return response(403, {}, "Not authorized", false)
    }

    console.log('Session found for user:', session.user._id)
    await connectDb()

    // Get all users except current user and AI user, sorted by username
    const allUsers = await User.find({ 
      _id: { $ne: session.user._id },
      email: { $ne: 'ai@gmail.com' }
    }).select('_id username email').sort({ username: 1 })

    console.log('Found users:', allUsers.length)
    console.log('Users data:', allUsers.map(u => ({ id: u._id, username: u.username, email: u.email })))

    // Get current user's friends (excluding blocked friendships)
    const friends = await Friend.find({ 
      userid: session.user._id,
      isBlocked: { $ne: true } // Exclude blocked friendships
    }).select('friendid')

    const friendIds = friends.map(friend => friend.friendid.toString())
    
    console.log('Active friends (non-blocked):', friendIds)
    console.log('All friendship records for user:', await Friend.find({ userid: session.user._id }).select('friendid isBlocked'))

    // Get pending friend requests sent by current user
    const sentRequests = await FriendRequest.find({ 
      senderId: session.user._id,
      status: 'pending'
    }).select('receiverId')

    const sentRequestIds = sentRequests.map(req => req.receiverId.toString())

    // Get pending friend requests received by current user
    const receivedRequests = await FriendRequest.find({ 
      receiverId: session.user._id,
      status: 'pending'
    }).select('senderId')

    const receivedRequestIds = receivedRequests.map(req => req.senderId.toString())

    console.log('Friend IDs:', friendIds)
    console.log('Sent request IDs:', sentRequestIds)
    console.log('Received request IDs:', receivedRequestIds)

    // Add friend status to each user
    const usersWithStatus = allUsers.map(user => {
      const userId = user._id.toString()
      let status = 'none' // none, friend, sent, received

      if (friendIds.includes(userId)) {
        status = 'friend'
      } else if (sentRequestIds.includes(userId)) {
        status = 'sent'
      } else if (receivedRequestIds.includes(userId)) {
        status = 'received'
      }

      console.log(`User ${user.username} (${userId}): status = ${status}`)

      return {
        _id: user._id,
        username: user.username,
        email: user.email,
        status
      }
    })

    return response(200, { users: usersWithStatus }, "Users fetched successfully", true)
  } catch (err) {
    console.error('Error fetching users:', err)
    console.error('Error stack:', err.stack)
    return response(500, { error: err?.message, details: err.stack }, "Failed to fetch users", false)
  }
}
