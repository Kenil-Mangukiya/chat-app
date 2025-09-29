import NextAuth from "next-auth";
import { authOption } from "./option";

const handler = NextAuth(authOption);

// Add error handling
handler.catch = (error) => {
  console.error("NextAuth error:", error);
  return new Response(JSON.stringify({ error: "Authentication failed" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
};

export { handler as POST, handler as GET };