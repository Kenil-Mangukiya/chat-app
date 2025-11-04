export const config = {
    mongodbUri : process.env.MONGODB_URI,
    dbName : process.env.DB_NAME,
    emailUser : process.env.EMAIL_USER,
    emailPass : process.env.EMAIL_PASS,
    emailHost : process.env.EMAIL_HOST,
    emailPort : Number(process.env.EMAIL_PORT),
    emailService : process.env.EMAIL_SERVICE,
    nextAuthSecret : process.env.NEXT_AUTH_SECRET,
    googleClientId : process.env.GOOGLE_CLIENT_ID,
    googleClientSecret : process.env.GOOGLE_CLIENT_SECRET,
    nodeEnv : process.env.NODE_ENV,
}