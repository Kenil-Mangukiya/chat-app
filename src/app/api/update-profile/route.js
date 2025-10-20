import { connectDb } from "@/db/connect-db"
import userModel from "@/model/user-model"
import friendModel from "@/model/friend-model"
import groupModel from "@/model/group-model"
import { response } from "@/util/response"
import { uploadToCloudinary, deleteFromCloudinary, extractPublicId } from "@/lib/cloudinary-config"
import { getServerSession } from "next-auth/next"
import { authOption } from "../auth/[...nextauth]/option"

export async function PUT(req) {
    await connectDb()

    try {
        // Get the current session
        const session = await getServerSession(authOption)
        
        if (!session?.user?._id) {
            return response(401, {}, "Unauthorized", false)
        }

        const formData = await req.formData()
        const username = formData.get('username')
        const profilePicture = formData.get('profilePicture')
        const removeProfilePicture = formData.get('removeProfilePicture')
        
        // Validate username
        if (!username || username.trim().length === 0) {
            return response(400, {}, "Username is required", false)
        }

        // Get the current user
        const user = await userModel.findById(session.user._id)
        if (!user) {
            return response(404, {}, "User not found", false)
        }

        // Check if username is already taken by another user
        const existingUser = await userModel.findOne({ 
            username: username.trim().toLowerCase(),
            _id: { $ne: session.user._id }
        })
        
        if (existingUser) {
            return response(400, {}, "Username is already taken", false)
        }

        let profilePicturePath = user.profilePicture // Keep existing if not updated
        
        // Handle profile picture removal
        if (removeProfilePicture === 'true') {
            // Delete old profile picture from Cloudinary if it exists
            if (user.profilePicture && user.profilePicture.includes('cloudinary.com')) {
                try {
                    const publicId = extractPublicId(user.profilePicture)
                    if (publicId) {
                        await deleteFromCloudinary(publicId)
                        console.log('Deleted old profile picture from Cloudinary:', publicId)
                    }
                } catch (deleteError) {
                    console.error('Error deleting old profile picture from Cloudinary:', deleteError)
                }
            }
            profilePicturePath = null
        }
        // Handle profile picture upload if provided
        else if (profilePicture && profilePicture.size > 0) {
            try {
                // Delete old profile picture from Cloudinary if it exists
                if (user.profilePicture && user.profilePicture.includes('cloudinary.com')) {
                    try {
                        const publicId = extractPublicId(user.profilePicture)
                        if (publicId) {
                            await deleteFromCloudinary(publicId)
                            console.log('Deleted old profile picture from Cloudinary:', publicId)
                        }
                    } catch (deleteError) {
                        console.error('Error deleting old profile picture from Cloudinary:', deleteError)
                    }
                }
                
                // Convert file to buffer for Cloudinary upload
                const bytes = await profilePicture.arrayBuffer()
                const buffer = Buffer.from(bytes)
                
                // Upload new profile picture to Cloudinary
                const cloudinaryResult = await uploadToCloudinary(buffer, 'chatly-profiles')
                profilePicturePath = cloudinaryResult.secure_url
                
                console.log('New profile picture uploaded to Cloudinary:', cloudinaryResult.secure_url)
            } catch (uploadError) {
                console.error('Error uploading profile picture to Cloudinary:', uploadError)
                // Keep existing profile picture if upload fails
                profilePicturePath = user.profilePicture
            }
        }

        // Update user in database
        const updateData = {
            username: username.trim().toLowerCase()
        }
        
        if (profilePicturePath !== undefined) {
            updateData.profilePicture = profilePicturePath
        }

        console.log('Updating user with data:', updateData)

        const updatedUser = await userModel.findByIdAndUpdate(
            session.user._id,
            updateData,
            { new: true }
        )

        console.log('Updated user:', updatedUser)

        if (!updatedUser) {
            return response(404, {}, "User not found", false)
        }

        // Profile pictures are now stored in Cloudinary, no local file cleanup needed

        // Update the user cache in the socket server
        if (global.updateUserCache) {
            await global.updateUserCache(session.user._id);
        }

        // Update friends list entries for all friends who have this user as a friend
        try {
            const friendsToUpdate = await friendModel.find({ friendid: session.user._id });
            console.log(`Found ${friendsToUpdate.length} friends to update in database`);
            console.log('Friends to update:', friendsToUpdate.map(f => ({ userid: f.userid, friendusername: f.friendusername })));
            
            for (const friend of friendsToUpdate) {
                const updateResult = await friendModel.findByIdAndUpdate(friend._id, {
                    friendusername: updatedUser.username,
                    friendprofilepicture: updatedUser.profilePicture,
                    friendemail: updatedUser.email
                });
                console.log(`Updated friend entry for user ${friend.userid}, result:`, updateResult ? 'success' : 'failed');
            }
        } catch (error) {
            console.error('Error updating friends list in database:', error);
        }

        // Update groups where this user is a member
        try {
            const groupsToUpdate = await groupModel.find({ 
                "members.userId": session.user._id 
            });
            console.log(`Found ${groupsToUpdate.length} groups to update in database`);
            
            for (const group of groupsToUpdate) {
                // Update the specific member in the members array
                const updatedMembers = group.members.map(member => {
                    if (member.userId.toString() === session.user._id.toString()) {
                        return {
                            ...member,
                            username: updatedUser.username,
                            profilePicture: updatedUser.profilePicture
                        };
                    }
                    return member;
                });
                
                await groupModel.findByIdAndUpdate(group._id, {
                    members: updatedMembers
                });
                console.log(`Updated group ${group._id} with new profile info`);
            }
        } catch (error) {
            console.error('Error updating groups in database:', error);
        }

        // Notify all connected users about the profile update
        console.log('Checking for socket instance...');
        console.log('global.io exists:', !!global.io);
        console.log('global.socketInstance exists:', !!global.socketInstance);
        
        const socketInstance = global.io || global.socketInstance;
        
        if (socketInstance) {
            const profileUpdateData = {
                userId: session.user._id,
                username: updatedUser.username,
                profilePicture: updatedUser.profilePicture,
                email: updatedUser.email
            };
            
            console.log('Emitting profile_updated event for user:', session.user._id);
            console.log('Profile data:', profileUpdateData);
            console.log('Profile picture path:', updatedUser.profilePicture);
            
            // Emit to all connected sockets about the profile update
            socketInstance.emit('profile_updated', profileUpdateData);
            
            console.log('Profile update event emitted successfully');
        } else {
            console.log('No socket instance available for profile update notification');
        }

        return response(200, {
            data: {
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                profilePicture: updatedUser.profilePicture
            },
            message: "Profile updated successfully"
        }, "Profile updated successfully", true)

    } catch (error) {
        console.error("Error updating profile:", error)
        return response(500, {}, error.message, false)
    }
}
