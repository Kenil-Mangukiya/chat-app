import { config } from "../config/config.js"
import mongoose from "mongoose"

const connection = {
    isConnected : 0
}

export const connectDb = async () => {
    if(connection.isConnected)
    {
        console.log("Already connected to the database")
        return
    }
    else
    {
        try
        {
            const mongoUri = config.mongodbUri || process.env.MONGODB_URI || "mongodb+srv://Project:Kenil@cluster0.87ku0.mongodb.net";
            const dbName = config.dbName || process.env.DB_NAME || "chat";
            
            console.log("mongodbUri is : ", mongoUri)
            const connectionInstance = await mongoose.connect(`${mongoUri}/${dbName}`)
            console.log("Successfully connected to the database at : ",connectionInstance.connection.host)
            connection.isConnected = connectionInstance.connection.readyState
            console.log("connection.isConnected is : ",connection.isConnected)
        }
        catch(error)
        {
            console.error("Error while connecting to the database : ",error)
            // Don't exit process in production, just log the error
            if (process.env.NODE_ENV === "production") {
                console.error("Database connection failed in production");
            } else {
                process.exit(1)
            }
        }
    }
}