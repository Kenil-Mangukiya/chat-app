import { NextResponse } from "next/server";
import message from "@/model/message-model";
import conversation from "@/model/conversation-model";
import { connectDB } from "@/db/connect-db";

export async function POST(request) {
    try {
        console.log("Call history API called");
        await connectDB();
        
        const { senderId, receiverId, callType, duration, status, direction, roomId } = await request.json();
        console.log("Received data:", { senderId, receiverId, callType, duration, status, direction, roomId });
        
        // Validate required fields
        if (!senderId || !receiverId || !callType || !direction || !roomId) {
            console.log("Missing required fields:", { senderId, receiverId, callType, direction, roomId });
            return NextResponse.json(
                { success: false, message: "Missing required fields" },
                { status: 400 }
            );
        }
        
        // Find or create conversation
        console.log("Looking for existing conversation...");
        let conversationDoc = await conversation.findOne({
            $or: [
                { participants: { $all: [senderId, receiverId] } },
                { participants: { $all: [receiverId, senderId] } }
            ]
        });
        
        if (!conversationDoc) {
            console.log("Creating new conversation...");
            conversationDoc = await conversation.create({
                participants: [senderId, receiverId],
                type: "direct"
            });
            console.log("Created conversation:", conversationDoc._id);
        } else {
            console.log("Found existing conversation:", conversationDoc._id);
        }
        
        // Create call history message
        console.log("Creating call message...");
        const callMessage = await message.create({
            conversationid: conversationDoc._id,
            senderid: senderId,
            receiverid: receiverId,
            type: "direct",
            messageType: "call",
            content: `${callType === "voice" ? "Voice" : "Video"} call`,
            callData: {
                callType,
                duration: duration || 0,
                status: status || "ended",
                direction,
                roomId
            }
        });
        console.log("Created call message:", callMessage._id);
        
        // Populate the message with user data
        console.log("Populating message data...");
        const populatedMessage = await message.findById(callMessage._id)
            .populate('senderid', 'username avatar')
            .populate('receiverid', 'username avatar');
        
        console.log("Call history stored successfully");
        return NextResponse.json({
            success: true,
            message: "Call history stored successfully",
            data: populatedMessage
        });
        
    } catch (error) {
        console.error("Error storing call history:", error);
        console.error("Error details:", {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        return NextResponse.json(
            { success: false, message: "Failed to store call history", error: error.message },
            { status: 500 }
        );
    }
}
