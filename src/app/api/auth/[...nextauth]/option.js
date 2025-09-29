import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { connectDb } from "@/db/connect-db";
import userModel from "@/model/user-model";
import { addAiFriendToUser } from "@/util/add-ai-friend";
import bcrypt from "bcryptjs";
import { config } from "@/config/config";

// Check for required environment variables
const requiredEnvVars = {
  NEXT_AUTH_SECRET: process.env.NEXT_AUTH_SECRET || config.nextAuthSecret,
  MONGODB_URI: process.env.MONGODB_URI || config.mongodbUri,
};

// Log missing environment variables in development
if (process.env.NODE_ENV === "development") {
  Object.entries(requiredEnvVars).forEach(([key, value]) => {
    if (!value) {
      console.warn(`⚠️  Missing environment variable: ${key}`);
    }
  });
}

export const authOption = {
  providers: [
    // Google OAuth Provider
    GoogleProvider({
      clientId: config.googleClientId || process.env.GOOGLE_CLIENT_ID,
      clientSecret: config.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),

    // Credentials Provider (for email/password login)
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email : ", type: "email", placeholder: "Enter username" },
        password: { label: "Password : ", type: "password", placeholder: "Enter password" },
      },
      async authorize(credentials) {
        try {
          await connectDb();
          
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Email and password are required");
          }
          
          // console.log("Authorizing with email:", credentials.email);
          const userData = await userModel.findOne({email: credentials.email});
          // console.log("User data found:", userData ? "yes" : "no");
          
          if (!userData) {
            throw new Error("Invalid email id");
          }
          
          const checkPassword = await bcrypt.compare(credentials.password, userData.password);
          if (checkPassword) {
            // Return a plain object with only necessary fields
            return {
              id: userData._id.toString(),
              _id: userData._id.toString(),
              email: userData.email,
              username: userData.username
            };
          } else {
            throw new Error("Incorrect password");
          }
        } catch (error) {
          console.error("Authorize error:", error);
          throw new Error(error.message || "Error while signing in");
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // console.log("SignIn callback running with provider:", account.provider);
        
        if (account.provider === "google") {
          await connectDb();
          // console.log("Google sign-in with email:", profile.email);
          
          if (!profile?.email) {
            console.error("No email in Google profile");
            return false;
          }
          
          const existingUser = await userModel.findOne({ email: profile.email });

          if (existingUser) {
            if (existingUser.googleId) {
              return true;
            } else {
              existingUser.googleId = profile.id;
              await existingUser.save();
              return "/sign-in";
            }
          } else {
            const newUser = new userModel({
              email: profile.email,
              username: profile.name?.replace(/\s+/g, '').toLowerCase() || profile.email.split('@')[0],
              googleid: profile.id,
              password: await bcrypt.hash(Math.random().toString(36).slice(-8), 10) 
            });

            await newUser.save();
            
            // Automatically add AI friend to the new Google user
            try {
              const aiFriendResult = await addAiFriendToUser(newUser._id);
              console.log("AI friend addition result for Google user:", aiFriendResult);
            } catch (error) {
              console.error("Failed to add AI friend for Google user:", error);
            }
            
            return "/sign-in";
          }
        }
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },

    async jwt({ token, user, account }) {
      // console.log("JWT callback running with user:", user ? "present" : "not present");
      
      // Only update the token when we have a user (usually on sign-in)
      if (user) {
        token._id = user._id || user.id;
        token.username = user.username;
        token.email = user.email;
      }
      
      return token;
    },
    
    async session({ session, token }) {
      // console.log("Session callback running with token:", token ? "present" : "not present");
      
      // Ensure session.user exists
      if (!session.user) {
        session.user = {};
      }
      
      // Copy properties from token to session
      if (token) {
        session.user._id = token._id;
        session.user.username = token.username;
        session.user.email = token.email;
      }
      
      // console.log("Session created successfully:", session);
      return session;
    },
  },

  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60,   // 24 hours
  },

  debug: process.env.NODE_ENV !== "production", // Only debug in development
  secret: config.nextAuthSecret || process.env.NEXT_AUTH_SECRET || "fallback-secret-key-for-development",
  
  // Add explicit URL configuration
  url: process.env.NEXTAUTH_URL || process.env.NEXT_AUTH_URL || "http://localhost:3000",
};

