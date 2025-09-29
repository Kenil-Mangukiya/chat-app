// pages/api/zego-token.js
import { generateToken04 } from "../../../lib/zegoServerAssistant"; // Token helper logic

export default async function handler(req, res) {
    if (req.method === "POST") {
        const { appID, userID, serverSecret, effectiveTimeInSeconds } = req.body;

        if (!appID || !userID || !serverSecret || !effectiveTimeInSeconds) {
            return res.status(400).json({ message: "Missing required parameters" });
        }

        try {
            const token = generateToken04(appID, userID, serverSecret, effectiveTimeInSeconds);
            if (token) {
                return res.status(200).json({ token });
            } else {
                return res.status(500).json({ message: "Failed to generate token" });
            }
        } catch (error) {
            console.error("Error generating token:", error);
            return res.status(500).json({ message: "Internal Server Error" });
        }
    } else {
        return res.status(405).json({ message: "Method Not Allowed" });
    }
}
