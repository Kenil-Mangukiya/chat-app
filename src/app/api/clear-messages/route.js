import { connectDb } from "@/db/connect-db";
import messageModel from "@/model/message-model";
import conversationModel from "@/model/conversation-model";
import { getServerSession } from "next-auth";
import { authOption as authOptions } from "../auth/[...nextauth]/option";
import { response } from "@/util/response";
import mongoose from "mongoose";

/**
 * API route to clear messages for a specific user only (not affecting the other user)
 * This creates a "cleared" state for the user without deleting actual messages
 */
export async function POST(req) {
    await connectDb();

    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?._id) {
            return response(401, {}, "Not authenticated", false);
        }

        const { senderId, receiverId } = await req.json();

        // Verify the user is part of this conversation
        if (senderId !== session.user._id) {
            return response(403, {}, "Not authorized to clear this conversation", false);
        }

        // Find the conversation
        const conversation = await conversationModel.findOne({
            participants: { $all: [senderId, receiverId] }
        });

        if (!conversation) {
            return response(404, {}, "Conversation not found", false);
        }

        // Instead of deleting messages, we'll mark them as "cleared" for this user
        // We'll store the last message ID that the user has seen before clearing
        const lastMessage = await messageModel.findOne({
            conversationid: conversation._id
        }).sort({ createdAt: -1 });

        if (lastMessage) {
            // Store the clear timestamp for this user
            await conversationModel.findByIdAndUpdate(conversation._id, {
                $set: {
                    [`clearedFor_${senderId}`]: {
                        clearedAt: Date.now(),
                        lastMessageId: lastMessage._id
                    }
                }
            });
        }

        console.log(`Messages cleared for user ${senderId} in conversation ${conversation._id}`);

        return response(200, { clearedFor: senderId }, "Messages cleared successfully for you only", true);

    } catch (error) {
        console.error("Error in clear-messages:", error);
        return response(500, {}, "Internal server error", false);
    }
}
