import { connectDb } from "@/db/connect-db";
import groupModel from "@/model/group-model";
import messageModel from "@/model/message-model";
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req) {
  try {
    await connectDb();
    const { senderId, receiverId } = await req.json();

    if (!senderId || !receiverId) {
      return NextResponse.json(
        { message: "senderId and receiverId are required" },
        { status: 400 }
      );
    }

    const isGroupChat =
      typeof receiverId === "string" && receiverId.startsWith("group_");
    const normalizedReceiverId = isGroupChat
      ? receiverId.replace("group_", "")
      : receiverId;

    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      return NextResponse.json(
        { message: "Invalid senderId" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(normalizedReceiverId)) {
      return NextResponse.json(
        { message: "Invalid receiverId" },
        { status: 400 }
      );
    }

    // 🕒 Get real current time and day
    const now = new Date();
    const currentDay = now.toLocaleDateString("en-US", { weekday: "long" });
    const currentTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    let conversationMessages = [];
    let prompt = "";

    // ============================================================
    // 🔹 Handle Group Chat
    // ============================================================
    if (isGroupChat) {
      const group = await groupModel
        .findById(normalizedReceiverId)
        .lean()
        .select({ members: 1, name: 1 });

      if (!group) {
        return NextResponse.json(
          { message: "Group not found" },
          { status: 404 }
        );
      }

      const isMember = group.members?.some(
        (member) => member.userId?.toString() === senderId
      );

      if (!isMember) {
        return NextResponse.json(
          { message: "You are not a member of this group" },
          { status: 403 }
        );
      }

      conversationMessages = await messageModel
        .find({
          receiverid: normalizedReceiverId,
          type: "group",
        })
        .sort({ createdAt: 1 })
        .lean();

      if (conversationMessages.length > 0) {
        const filteredMessages = conversationMessages
          .filter(
            (msg) =>
              msg.content &&
              msg.content !== "Message Deleted" &&
              msg.messageType === "text"
          )
          .map((msg) => {
            const speaker =
              msg.senderid?.toString() === senderId ? "You" : "Member";
            return `${speaker}: ${msg.content}`;
          })
          .join("\n");

        prompt = `
You are assisting in a group chat named "${group.name || "Group"}".

Current real-world context:
- Today is ${currentDay}.
- The current time is ${currentTime}.

Conversation so far:
${filteredMessages}

Your Task:
- Suggest a single, natural reply the user ("You") could send next.
- Keep it in the same language, tone, and style as the chat.
- Use current day/time awareness when referencing time (e.g., if today is Saturday, mention weekend vibes if appropriate).
- Make your tone friendly, optimistic, and slightly uplifting — bring good energy, but stay natural.
- Use emojis only when they feel right (funny 😅, friendly 😊, chill 😎, positive ✨).
- Keep it short (1–2 sentences max).
- Return only the suggested message text — no explanations or formatting.

Now, suggest the next message:
        `;
      } else {
        prompt = `
You are assisting a user who wants to send the first message in a group chat named "${group.name || "Group"}".

Context:
- Today is ${currentDay}.
- The current time is ${currentTime}.

Your Task:
- Suggest a short, friendly opening message with a positive tone.
- Example: "Hey everyone 👋 hope you're all doing great today!"
- Keep it natural, inclusive, and optimistic.
- Use emojis if it feels right.
- Return only the plain text message.

Start the conversation:
        `;
      }
    }

    // ============================================================
    // 🔹 Handle One-to-One Chat
    // ============================================================
    else {
      const existingConversation = await messageModel.findOne({
        $or: [
          { senderid: senderId, receiverid: normalizedReceiverId },
          { senderid: normalizedReceiverId, receiverid: senderId },
        ],
      });

      if (existingConversation) {
        conversationMessages = await messageModel
          .find({
            conversationid: existingConversation.conversationid,
          })
          .sort({ createdAt: 1 })
          .lean();
      }

      if (conversationMessages.length > 0) {
        const filteredMessages = conversationMessages
          .filter((msg) => msg.content && msg.content !== "Message Deleted")
          .map((msg) => {
            const speaker =
              msg.senderid?.toString() === senderId ? "You" : "Friend";
            return `${speaker}: ${msg.content}`;
          });

        const conversationText = filteredMessages.join("\n");

        const lastMsg = conversationMessages[conversationMessages.length - 1];
        const lastSender =
          lastMsg?.senderid?.toString() === senderId ? "You" : "Friend";

        if (lastSender === "Friend") {
          prompt = `
You are a smart, emotionally aware, and optimistic chat assistant.

Current context:
- Today is ${currentDay}.
- Current time is ${currentTime}.

Here’s the recent conversation:
${conversationText}

Your Task:
- Generate a natural, human-like reply YOU (the sender) would send in response to the Friend’s last message.
- Use the current day/time naturally if mentioned (e.g., if today is Saturday, you can say “finally weekend vibes 😄”).
- Maintain the same language and tone as the ongoing chat.
- Keep the reply positive, friendly, and lighthearted — aim to make the chat feel engaging and warm.
- Use emojis only if they fit well (funny 😂, friendly 😊, chill 😎, heartwarming ❤️, etc.).
- Keep it short (1–2 sentences).
- Return only the plain text message — no explanations or markdown.

Suggest your reply:
          `;
        } else {
          prompt = `
You are a smart, emotionally aware, and optimistic chat assistant.

Current context:
- Today is ${currentDay}.
- Current time is ${currentTime}.

Here’s the recent conversation:
${conversationText}

Your Task:
- The last message was sent by YOU, so now suggest a short, natural follow-up message.
- Continue the chat flow naturally and warmly.
- Keep your tone friendly, slightly upbeat, and engaging.
- If it makes sense, casually mention the current day (like “can’t believe it’s already ${currentDay} 😅”) or express a nice vibe about it.
- Use emojis when they fit naturally.
- Limit to 1–2 sentences.
- Return only the suggested message text.

Suggest your next message:
          `;
        }
      } else {
        prompt = `
You are a friendly, emotionally intelligent, and optimistic chat assistant.

Context:
- Today is ${currentDay}.
- Current time is ${currentTime}.

Your Task:
- Suggest a short, natural greeting to start a conversation with someone new.
- Keep it light, positive, and friendly.
- Examples: "Hey 👋", "Hi there 😄", "Heyy 😊 how’s your ${currentDay} going?"
- Use emojis if it feels natural.
- Return only the greeting message.

Start the conversation:
        `;
      }
    }

    // ============================================================
    // 🔹 Generate AI Response
    // ============================================================
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt.toString(),
    });

    const aiText =
      response?.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      response.text ||
      "";

    console.log("AI suggested message:", aiText);

    return NextResponse.json({
      message: "Success",
      data: aiText.trim(),
    });
  } catch (error) {
    console.error("Error generating AI message:", error);
    return NextResponse.json(
      {
        message: "Error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
