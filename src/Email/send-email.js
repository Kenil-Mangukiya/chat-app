import { response } from "@/util/response";
import { config } from "@/config/config";
import axios from "axios";

export const sendEmail = async function(username, email, otp) {
    try {
        // Use SendGrid HTTP API with axios (more reliable in Node.js)
        const sendGridResponse = await axios.post(
            'https://api.sendgrid.com/v3/mail/send',
            {
                personalizations: [{
                    to: [{ email: email, name: username }],
                    subject: "Your OTP for Registration of Chat"
                }],
                from: {
                    email: config.emailUser, // Your verified sender email
                    name: "Chat App"
                },
                content: [{
                    type: 'text/html',
                    value: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>Registration OTP</title>
                        </head>
                        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9f9;">
                            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
                                <div style="background: linear-gradient(135deg, #6a11cb 0%, #2575fc 100%); padding: 30px 20px; text-align: center;">
                                    <h1 style="color: white; margin: 0; font-size: 28px;">Registration Verification</h1>
                                </div>
                                <div style="padding: 30px 40px;">
                                    <p style="font-size: 16px; color: #333; margin-top: 0; line-height: 1.5;">
                                        Hello <span style="font-weight: bold; color: #2575fc; font-size: 18px;">${username}</span>,
                                    </p>
                                    <p style="font-size: 16px; color: #555; line-height: 1.5;">
                                        Thank you for registering with our service. To complete your registration, please use the verification code below:
                                    </p>
                                    <div style="background-color: #f5f8ff; border: 2px dashed #2575fc; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center;">
                                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Your One-Time Password</p>
                                        <div style="font-family: 'Courier New', monospace; font-size: 32px; letter-spacing: 5px; font-weight: bold; color: #2575fc;">
                                            ${otp}
                                        </div>
                                        <p style="margin: 10px 0 0 0; font-size: 12px; color: #888;">This code will expire in 10 minutes</p>
                                    </div>
                                    <p style="font-size: 16px; color: #555; line-height: 1.5;">
                                        If you did not request this verification, please disregard this email.
                                    </p>
                                </div>
                                <div style="background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #eaeaea;">
                                    <p style="margin: 0; color: #777; font-size: 14px;">
                                        &copy; 2025 Your Company Name. All rights reserved.
                                    </p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                }]
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.emailPass}`, // Your SendGrid API key
                    'Content-Type': 'application/json',
                },
                timeout: 30000, // 30 second timeout
                // Force IPv4 if IPv6 is causing issues
                family: 4, // Use IPv4 only
            }
        );

        console.log("Email is sent successfully");
        return response(200, "OTP is sent to your email address");
    } catch (error) {
        // Handle errors
        if (error.code === 'ECONNABORTED') {
            console.log(`Error: Timeout while sending email to ${username}`);
            throw new Error('Email service timeout. Please try again.');
        } else if (error.response) {
            // SendGrid API returned an error
            console.error('SendGrid API error:', error.response.status, error.response.data);
            throw new Error(`SendGrid API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            // Request was made but no response received
            console.log(`Error: No response from SendGrid while sending email to ${username}`);
            throw new Error('Email service connection error. Please check your network.');
        } else {
            console.log(`Error: While sending email to ${username} is ${error.message || error}`);
            throw error;
        }
    }
}