# Chatly

*Enterprise-grade real-time messaging platform with AI integration and seamless collaboration tools.*

<img width="835" height="602" alt="Image" src="https://github.com/user-attachments/assets/2abeaf0c-e0c1-4e59-bde8-8951d6d02ab1" />

## 🚀 Project Overview

Chatly is a production-ready, full-stack messaging application that delivers instant communication through WebSocket-powered real-time messaging, intelligent AI assistance, and comprehensive collaboration features. Built with modern web technologies, it provides a scalable foundation for team communication, customer support, or social networking platforms. The platform automates user onboarding, manages complex friend relationships, and enables seamless group interactions with enterprise-level reliability.

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - UI library with latest features
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Advanced animations
- **Radix UI** - Accessible component primitives
- **React Hook Form + Zod** - Form validation and management
- **Emoji Mart** - Rich emoji picker integration

### Backend
- **Node.js** - Runtime environment
- **Custom Express Server** - HTTP server with Socket.io integration
- **Next.js API Routes** - Serverless API endpoints
- **Socket.io** - Real-time bidirectional communication
- **NextAuth.js** - Authentication with JWT and OAuth

### Database & Storage
- **MongoDB** - NoSQL database with Mongoose ODM
- **Cloudinary** - Media storage and CDN for images/videos

### Integrations
- **Google Gemini AI** - AI-powered chatbot assistance
- **SendGrid API** - Transactional email delivery
- **Google OAuth** - Social authentication
- **ZegoCloud** - Video/voice calling infrastructure (configured)

### DevOps
- **PM2** - Process management for production
- **Nodemon** - Development auto-reload

![Next.js](https://img.shields.io/badge/Next.js-15.3.1-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react)
![MongoDB](https://img.shields.io/badge/MongoDB-5.9.2-47A248?style=for-the-badge&logo=mongodb)
![Socket.io](https://img.shields.io/badge/Socket.io-4.8.1-010101?style=for-the-badge&logo=socket.io)

## ✨ Key Features

### 🔄 Real-Time Communication
- **Instant Messaging**: WebSocket-powered real-time message delivery with Socket.io
- **Online Presence**: Live user status tracking (online/offline indicators)
- **Typing Indicators**: Real-time typing status for enhanced user experience
- **Read Receipts**: Message read status tracking with visual indicators

### 🤖 AI-Powered Assistant
- **Gemini AI Integration**: Intelligent chatbot that responds contextually to user messages
- **Automatic AI Friend**: Every new user receives an AI assistant friend upon registration
- **Smart Message Suggestions**: AI-powered message completion and suggestions

### 👥 Social & Collaboration
- **Friend Management**: Complete friend request system with accept/decline/block capabilities
- **Group Chats**: Create and manage group conversations with role-based permissions (owner/admin/member)
- **Group Invitations**: Invite friends to groups with real-time notifications
- **User Discovery**: Search and add users by username or email

### 📎 Rich Media Support
- **File Attachments**: Upload and share images, videos, audio files, and documents
- **Cloudinary Integration**: Optimized media storage with automatic format conversion
- **Profile Pictures**: Custom avatar uploads with Cloudinary CDN delivery
- **Media Preview**: Inline previews for images and videos

### 🔔 Advanced Notifications
- **Real-Time Push Notifications**: Socket-based notification system with queuing
- **Notification Center**: Centralized notification management
- **Mute Functionality**: Per-chat notification muting
- **Friend Request Alerts**: Instant notifications for friend requests and responses

### 🔐 Security & Authentication
- **Multi-Provider Auth**: Google OAuth and email/password authentication via NextAuth.js
- **JWT Sessions**: Secure token-based session management
- **OTP Verification**: Email-based one-time password verification for registration
- **Password Hashing**: bcryptjs for secure password storage

### 🎨 User Experience
- **Responsive Design**: Mobile-first UI that adapts to all screen sizes
- **Voice Input**: Speech-to-text integration for hands-free messaging
- **Emoji Picker**: Rich emoji selection with Emoji Mart
- **Message Search**: Search functionality across conversations
- **Dark Mode Ready**: UI components designed for theme switching

## ⚙️ Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- MongoDB database (local or Atlas)
- Cloudinary account
- SendGrid API key
- Google OAuth credentials (optional)
- Google Gemini API key (optional)

### Step 1: Clone Repository
```bash
git clone https://github.com/your-username/chat-app.git
cd chat-app
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Environment Configuration
Create a `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net
DB_NAME=chat

# Application
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3008
NEXT_PUBLIC_SOCKET_URL=http://localhost:3008
PORT=3008
NODE_ENV=development

# Authentication
NEXTAUTH_URL=http://localhost:3008
NEXTAUTH_SECRET=your-secret-key-here
NEXT_AUTH_SECRET=your-secret-key-here

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Service (SendGrid)
EMAIL_USER=your-verified-sender@email.com
EMAIL_PASS=SG.your-sendgrid-api-key
EMAIL_HOST=api.sendgrid.com
EMAIL_PORT=443
EMAIL_SERVICE=gmail

# AI Integration
GEMINI_API_KEY=your-gemini-api-key

# Media Storage
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Video Calling (Optional)
NEXT_PUBLIC_ZEGOCLOUD_APP_ID=your-zego-app-id
NEXT_PUBLIC_ZEGOCLOUD_SERVER_SECRET=your-zego-secret
```

### Step 4: Run Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3008`

### Step 5: Production Deployment

#### Using PM2 (Recommended)
1. Build the application:
```bash
npm run build
```

2. Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'chatly',
    script: 'src/app/api/server.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      // Copy all environment variables from .env
    }
  }]
};
```

3. Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
```

## 🔮 Future Improvements

### Performance & Scalability
- **Redis Caching**: Implement Redis for session management and real-time data caching to reduce MongoDB load and improve response times
- **Message Pagination**: Add cursor-based pagination for message history to handle large conversation threads efficiently

### Feature Enhancements
- **End-to-End Encryption**: Implement E2EE for message security using WebCrypto API
- **Voice/Video Calls**: Complete ZegoCloud integration for native in-app calling functionality
- **Message Reactions**: Add emoji reactions and message threading for better conversation organization
- **File Sharing Limits**: Implement file size limits and storage quotas per user
- **Advanced Search**: Full-text search across all messages with Elasticsearch integration
- **Message Editing/Deleting**: Allow users to edit or delete sent messages within a time window

---

**Built with ❤️ using Next.js, Socket.io, and MongoDB**

