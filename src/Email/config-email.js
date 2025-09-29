import nodemailer from "nodemailer"
import { config } from "@/config/config";

export const transporter = nodemailer.createTransport({
  service : config.emailService,
  host: config.emailHost,
  port: config.emailPort,
  secure: false, 
  auth: {
    user : config.emailUser,
    pass : config.emailPass,
  },
});