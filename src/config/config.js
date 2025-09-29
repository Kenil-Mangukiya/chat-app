export const config = {
    mongodbUri : process.env.MONGODB_URI || "mongodb+srv://Project:Kenil@cluster0.87ku0.mongodb.net",
    dbName : process.env.DB_NAME || "chat",
    emailUser : process.env.EMAIL_USER,
    emailPass : process.env.EMAIL_PASS,
    emailHost : process.env.EMAIL_HOST,
    emailPort : Number(process.env.EMAIL_PORT),
    emailService : process.env.EMAIL_SERVICE,
    nextAuthSecret : process.env.NEXT_AUTH_SECRET,
    googleClientId : process.env.GOOGLE_CLIENT_ID,
    googleClientSecret : process.env.GOOGLE_CLIENT_SECRET,
    zegoCloudAppId : Number(process.env.NEXT_PUBLIC_ZEGOCLOUD_APP_ID),
    zegoCloudServerSecret : process.env.NEXT_PUBLIC_ZEGOCLOUD_SERVER_SECRET
}