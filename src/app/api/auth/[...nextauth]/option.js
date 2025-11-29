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
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || config.nextAuthSecret,
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
            throw new Error("Invalid credentials");
          }
          
          // Check if user registered with Google
          if (userData.googleid) {
            throw new Error("GOOGLE_ACCOUNT");
          }
          
          const checkPassword = await bcrypt.compare(credentials.password, userData.password);
          if (checkPassword) {
            // Return a plain object with only necessary fields
            return {
              id: userData._id.toString(),
              _id: userData._id.toString(),
              email: userData.email,
              username: userData.username,
              profilePicture: userData.profilePicture
            };
          } else {
            throw new Error("Invalid credentials");
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
            if (existingUser.googleid) {
              // Already linked; ensure AI friend exists
              try {
                const aiFriendResult = await addAiFriendToUser(existingUser._id);
                console.log("AI friend check result for existing Google user:", aiFriendResult);
              } catch (error) {
                console.error("Failed to ensure AI friend for existing Google user:", error);
              }
              return true; // Already linked; use DB-stored username/profilePicture
            } else {
              // Link Google account to existing user without changing profile data
              existingUser.googleid = profile.id;
              // Do NOT set profile picture from Google, even if null — respect user's removal
              // Do NOT overwrite username — respect user-chosen username
              await existingUser.save();
              
              // Automatically add AI friend when linking Google account
              try {
                const aiFriendResult = await addAiFriendToUser(existingUser._id);
                console.log("AI friend addition result for linked Google account:", aiFriendResult);
              } catch (error) {
                console.error("Failed to add AI friend for linked Google account:", error);
              }
              
              return true;
            }
          } else {
            // Create new user with Google account
            const newUser = new userModel({
              email: profile.email,
              username: profile.name?.replace(/\s+/g, '').toLowerCase() || profile.email.split('@')[0],
              googleid: profile.id,
              profilePicture: profile.picture,
              password: await bcrypt.hash(Math.random().toString(36).slice(-8), 10) 
            });

            await newUser.save();
            
            // Automatically add AI friend to the new Google user
            try {
              const aiFriendResult = await addAiFriendToUser(newUser._id);
              console.log("AI friend addition result for new Google user:", aiFriendResult);
            } catch (error) {
              console.error("Failed to add AI friend for new Google user:", error);
            }
            
            return true; // Allow sign-in and redirect to /
          }
        }
        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },

    async jwt({ token, user, account, trigger }) {
      // console.log("JWT callback running with user:", user ? "present" : "not present");
      
      // Only update the token when we have a user (usually on sign-in)
      if (user) {
        // For Google OAuth, we need to fetch the user from database to get proper MongoDB ObjectId
        if (account?.provider === "google") {
          try {
            await connectDb();
            const dbUser = await userModel.findOne({ email: user.email });
            if (dbUser) {
              token._id = dbUser._id.toString();
              token.username = dbUser.username;
              token.email = dbUser.email;
              token.profilePicture = dbUser.profilePicture;
            }
          } catch (error) {
            console.error("Error fetching user in JWT callback:", error);
            // Fallback to user data
            token._id = user._id || user.id;
            token.username = user.username;
            token.email = user.email;
          }
        } else {
          token._id = user._id || user.id;
          token.username = user.username;
          token.email = user.email;
          token.profilePicture = user.profilePicture;
        }
      }
      
      // If this is a session update trigger, fetch fresh user data from database
      if (trigger === "update" && token._id) {
        try {
          await connectDb();
          const dbUser = await userModel.findById(token._id);
          if (dbUser) {
            token.username = dbUser.username;
            token.email = dbUser.email;
            token.profilePicture = dbUser.profilePicture;
          }
        } catch (error) {
          console.error("Error fetching updated user data in JWT callback:", error);
        }
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
        session.user.profilePicture = token.profilePicture;
        // Keep name/image in sync so UI never falls back to Google defaults
        session.user.name = token.username;
        session.user.image = token.profilePicture;
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
  
  debug: config.nodeEnv !== "production", // Only debug in development
  secret: config.nextAuthSecret,
  
  // Ensure we use the correct base URL
  trustHost: true, // Trust the host header (important for production)
};

