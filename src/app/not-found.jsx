"use client"

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft, Search } from 'lucide-react'

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="text-center max-w-2xl mx-auto">
        {/* Animated Emoji/Icon */}
        <div className="mb-8 animate-bounce">
          <div className="text-9xl mb-4">😕</div>
          <div className="text-6xl mb-2">404</div>
        </div>

        {/* Main Message */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
          Oops! Page Not Found
        </h1>
        
        <p className="text-xl text-gray-600 mb-8">
          The page you're looking for seems to have wandered off into the digital void. 
          <span className="block mt-2">Let's get you back on track! 🚀</span>
        </p>

        {/* Decorative Icons */}
        <div className="flex justify-center gap-4 mb-8 text-4xl">
          <span className="animate-pulse">🔍</span>
          <span className="animate-pulse delay-75">💬</span>
          <span className="animate-pulse delay-150">✨</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            onClick={() => router.push('/chat')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
          >
            <Home className="w-5 h-5" />
            Go to Chat
          </Button>
          
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="border-2 border-gray-300 hover:border-indigo-500 text-gray-700 hover:text-indigo-600 px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </Button>
        </div>

        {/* Fun Message */}
        <p className="mt-12 text-sm text-gray-500">
          While you're here, why not check out our amazing chat features? 💭
        </p>
      </div>
    </div>
  )
}

