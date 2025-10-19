import React from 'react';
import { MessageCircle } from 'lucide-react';

export function ChatlyLoader({ message = "Loading your conversations..." }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        {/* Circular Progress with Chat Icon */}
        <div className="relative mb-6">
          {/* Outer ring */}
          <div className="w-20 h-20 rounded-full border-4 border-blue-200 mx-auto"></div>
          
          {/* Progress ring */}
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-20 h-20 rounded-full border-4 border-transparent border-t-blue-500 border-r-blue-500 animate-spin"></div>
          
          {/* Chat icon in center */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <MessageCircle size={24} className="text-blue-500 animate-pulse" />
          </div>
        </div>

        {/* Three dots */}
        <div className="flex justify-center space-x-1 mb-4">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Chatly</h1>
        
        {/* Subtitle */}
        <p className="text-gray-600 text-sm mb-8">{message}</p>

        {/* Progress bar */}
        <div className="w-64 h-1 bg-blue-100 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{
            animation: 'progress 2s ease-in-out infinite'
          }}></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 75%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
