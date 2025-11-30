import { connectDb } from "@/db/connect-db";
import friendModel from "@/model/friend-model";
import userModel from "@/model/user-model";
import mongoose from "mongoose";

/**
 * Utility function to automatically add AI friend to user's friend list
 * @param {string} userId - The user ID to add AI friend for
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function addAiFriendToUser(userId) {
    try {
        await connectDb();
        
        // Find AI user in user model
        const aiUser = await userModel.findOne({ email: "ai@gmail.com" });
        
        if (!aiUser) {
            console.error("AI user not found in database");
            return { success: false, message: "AI user not found" };
        }

        // Check if AI friend already exists for this user (use actual AI user id)
        const existingAiFriend = await friendModel.findOne({
            userid: new mongoose.Types.ObjectId(userId),
            friendid: new mongoose.Types.ObjectId(aiUser._id)
        });

        if (existingAiFriend) {
            console.log("AI friend already exists for user:", userId);
            return { success: true, message: "AI friend already exists" };
        }

        // Create AI friend relationship
        const createAiFriend = await friendModel.create({
            userid: new mongoose.Types.ObjectId(userId),
            friendid: aiUser._id,
            friendusername: aiUser.username,
            friendemail: aiUser.email,
            friendprofilepicture: aiUser.profilePicture
        });

        console.log("AI friend added successfully for user:", userId);
        return { success: true, message: "AI friend added successfully" };

    } catch (error) {
        console.error("Error adding AI friend:", error);
        return { success: false, message: "Failed to add AI friend" };
    }
}
