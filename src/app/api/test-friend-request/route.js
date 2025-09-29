import { connectDb } from "@/db/connect-db"
import friendRequestModel from "@/model/friend-request-model.js"
import { response } from "@/util/response"

export async function GET(req) {
    try {
        await connectDb()
        
        // Get all friend requests
        const allRequests = await friendRequestModel.find({})
        
        return response(200, { 
            count: allRequests.length,
            requests: allRequests 
        }, "Friend requests retrieved", true)
    } catch (error) {
        console.error("Error in test-friend-request:", error)
        return response(500, {}, "Internal server error", false)
    }
}

export async function DELETE(req) {
    try {
        await connectDb()
        
        // Delete all friend requests (for testing)
        const result = await friendRequestModel.deleteMany({})
        
        return response(200, { 
            deletedCount: result.deletedCount
        }, "All friend requests deleted", true)
    } catch (error) {
        console.error("Error in test-friend-request delete:", error)
        return response(500, {}, "Internal server error", false)
    }
}
