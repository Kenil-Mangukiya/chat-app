import { connectDb } from "@/db/connect-db"
import { sendEmail } from "@/Email/send-email"
import userModel from "@/model/user-model"
import { response } from "@/util/response"
import { addAiFriendToUser } from "@/util/add-ai-friend"
import bcrypt from "bcryptjs"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

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
            const bytes = await profilePicture.arrayBuffer()
            const buffer = Buffer.from(bytes)
            
            // Create uploads directory if it doesn't exist
            const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'profiles')
            await mkdir(uploadsDir, { recursive: true })
            
            // Generate unique filename
            const timestamp = Date.now()
            const fileExtension = path.extname(profilePicture.name)
            const filename = `${username}_${timestamp}${fileExtension}`
            const filepath = path.join(uploadsDir, filename)
            
            // Save file
            await writeFile(filepath, buffer)
            profilePicturePath = `/uploads/profiles/${filename}`
        }

        const createUser = await userModel.create({
            username,
            email,
            password : hashPassword,
            otp,
            profilePicture: profilePicturePath
        })

        console.log("Created user is : ",createUser)

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