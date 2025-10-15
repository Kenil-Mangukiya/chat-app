import { NextResponse } from "next/server";
import message from "@/model/message-model";
import conversation from "@/model/conversation-model";
import { connectDb } from "@/db/connect-db";
import { emitToUser } from "@/lib/socket-server";

export async function POST(request) {
    try {
        console.log("Call history API called");
        await connectDb();
        
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
        
        // Upsert call history message by roomId to avoid duplicates
        console.log("Upserting call message by roomId...");
        const existing = await message.findOne({
            conversationid: conversationDoc._id,
            messageType: "call",
            "callData.roomId": roomId
        });

        let callMessage;
        if (existing) {
            const newDuration = Math.max(existing.callData?.duration || 0, duration || 0);
            existing.callData.duration = newDuration;
            existing.callData.status = status || existing.callData.status || "ended";
            // Keep original direction/sender/receiver to preserve who initiated; don't flip sides
            await existing.save();
            callMessage = existing;
            console.log("Updated existing call message:", callMessage._id);
        } else {
            callMessage = await message.create({
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
            console.log("Created new call message:", callMessage._id);
        }
        
        // Populate the message with user data
        console.log("Populating message data...");
        const populatedMessage = await message.findById(callMessage._id)
            .populate('senderid', 'username avatar')
            .populate('receiverid', 'username avatar');
        
        // Emit to both participants so chat updates in real-time
        try {
            emitToUser(senderId, "send_message_to_sender", populatedMessage);
            emitToUser(receiverId, "send_message_to_receiver", populatedMessage);
            // Also emit generic events some UIs listen for
            emitToUser(senderId, "message_sent", populatedMessage);
            emitToUser(receiverId, "receive_message", populatedMessage);
        } catch (e) {
            console.log("Non-fatal: error emitting call history events", e);
        }

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
