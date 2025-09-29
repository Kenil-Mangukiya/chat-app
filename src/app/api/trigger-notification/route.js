import { response } from "@/util/response"
import { getSocketInstance } from "@/lib/socket-server.js"

export async function POST(req) {
    try {
        const { receiverId, senderUsername } = await req.json()
        
        console.log("Trigger notification API called for:", receiverId, "from:", senderUsername)
        
        const io = getSocketInstance()
        if (io) {
            io.to(receiverId).emit("friend_request_received", {
                senderUsername,
                timestamp: new Date()
            })
            console.log("Fallback notification emitted successfully")
            return response(200, {}, "Notification triggered successfully", true)
        } else {
            console.log("Socket instance not available for fallback")
            return response(500, {}, "Socket instance not available", false)
        }
    } catch (error) {
        console.error("Error in trigger-notification:", error)
        return response(500, {}, "Internal server error", false)
    }
}
