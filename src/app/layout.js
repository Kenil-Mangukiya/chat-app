import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "./auth-provider/AuthProvider";
import { ToastContainer } from "react-toastify";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Chat App",
  description: "Real-time chat messaging application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider> 
         {children}
        <ToastContainer/>
        <Analytics />
        <SpeedInsights />
        </AuthProvider>
      </body>
    </html>
  );
}
