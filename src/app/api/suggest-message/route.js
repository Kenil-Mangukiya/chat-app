import messageModel from "@/model/message-model";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: "AIzaSyAi4Qo2WNX7vOesGW_Rwz9vP8HfOwZLzjE"  });

export async function POST(req) {
  try {
    const { senderId, receiverId } = await req.json();

    // Check if any previous conversation exists
    const existingConversation = await messageModel.findOne({
      $or: [
        { senderid: senderId, receiverid: receiverId },
        { senderid: receiverId, receiverid: senderId },
      ],
    });
    
    let prompt = "";

    if (existingConversation) {
      const allMessages = await messageModel.find({
        conversationid: existingConversation.conversationid,
      });

      const filteredMessages = allMessages
        .filter((msg) => msg.content !== "Message Deleted")
        .map((msg) => msg.content)
        .join("\n");

      prompt = `
You are an intelligent message assistant. Your job is to analyze the full conversation below between two users and suggest the next message in the same language the users are communicating in.

Conversation:
${filteredMessages}

Rules:
- Detect the main language used (e.g., English, Hindi, Hinglish, etc.)
- Suggest one natural, context-aware message the user can send next
- Keep the tone consistent with the conversation style
- Do NOT explain anything, just return the message text only

Suggest the next message:
      `;
    } else {
      // No previous messages
      prompt = `
You are an intelligent AI assistant. A user is about to start a conversation with someone new.

Rules:
- Greet the other person in a friendly and respectful way
- Detect the user's preferred language (use English if unknown)
- Start the conversation naturally with a short and simple sentence
- Do NOT explain anything, just return the message text only

Start the conversation:
      `;
    }

    const response = await ai.models.generateContent({
            model : "gemini-2.0-flash",
            contents : prompt.toString()
        })

    console.log("response.text is : ",response.text)

    return NextResponse.json({
      message: "Success",
      data: response.text.trim(),
    });
  } catch (error) {
    console.log("Error is:", error);
    return NextResponse.json(
      {
        message: "Error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
