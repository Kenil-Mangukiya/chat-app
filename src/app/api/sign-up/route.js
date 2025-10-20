import { connectDb } from "@/db/connect-db"
import { sendEmail } from "@/Email/send-email"
import userModel from "@/model/user-model"
import { response } from "@/util/response"
import { addAiFriendToUser } from "@/util/add-ai-friend"
import bcrypt from "bcryptjs"
import { uploadToCloudinary } from "@/lib/cloudinary-config"

export async function POST(req,res)
{
    await connectDb()

    try
    {
        const formData = await req.formData()
        const username = formData.get('username')
        const email = formData.get('email')
        const password = formData.get('password')
        const otp = formData.get('otp')
        const profilePicture = formData.get('profilePicture')
        
        console.table([username,email,password])

        const hashPassword = await bcrypt.hash(password,10)

        let profilePicturePath = null
        
        // Handle profile picture upload if provided
        if (profilePicture && profilePicture.size > 0) {
            try {
                // Convert file to buffer for Cloudinary upload
                const bytes = await profilePicture.arrayBuffer()
                const buffer = Buffer.from(bytes)
                
                // Upload to Cloudinary
                const cloudinaryResult = await uploadToCloudinary(buffer, 'chatly-profiles')
                profilePicturePath = cloudinaryResult.secure_url
                
                console.log('Profile picture uploaded to Cloudinary:', {
                    secure_url: cloudinaryResult.secure_url,
                    public_id: cloudinaryResult.public_id,
                    format: cloudinaryResult.format
                })
            } catch (uploadError) {
                console.error('Error uploading profile picture to Cloudinary:', uploadError)
                // Continue without profile picture if upload fails
                profilePicturePath = null
            }
        }

        const createUser = await userModel.create({
            username,
            email,
            password : hashPassword,
            otp,
            profilePicture: profilePicturePath
        })

        console.log("Created user is : ", {
            _id: createUser._id,
            username: createUser.username,
            email: createUser.email,
            profilePicture: createUser.profilePicture,
            hasProfilePicture: !!createUser.profilePicture
        })

        // Automatically add AI friend to the new user
        try {
            const aiFriendResult = await addAiFriendToUser(createUser._id);
            console.log("AI friend addition result:", aiFriendResult);
        } catch (error) {
            console.error("Failed to add AI friend during registration:", error);
            // Don't fail the registration if AI friend addition fails
        }

        return response(200,createUser,"User registered successfully",true);

    }
    catch(error)
    {
        console.log(error)
        return response(500,{},error.message,false)
    }

}