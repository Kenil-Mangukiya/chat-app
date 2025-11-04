"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { signIn, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "react-toastify"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { FiMail, FiLock, FiEye, FiEyeOff } from "react-icons/fi"
import { FaGoogle } from "react-icons/fa"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { signinSchema } from "@/schema/sign-in-schema"
// Removed unused auth options import
import axios from "axios"

function SignInPage() {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const router = useRouter()
  const {data : session,status} = useSession()
  // If already authenticated, redirect to /
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/")
    }
  }, [status, router])
 
  const form = useForm({
    resolver: zodResolver(signinSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  })

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true)
      await signIn("google", { callbackUrl: "/" })
    } catch (error) {
      console.error("Google sign-in error:", error)
      toast.error("Google sign-in failed. Please try again.")
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const onSubmit = async (data) => {
    try {
      setLoading(true)
      const response = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password
      })
      
      if (response?.error) {  
        toast.error("Invalid credentials")
      } else {
        toast.success("Successfully signed in!")
        
        // Ensure AI friend is added after successful login
        try {
          const addAiFriend = await axios.post("/api/ensure-ai-friend")
          console.log("AI friend ensure result:", addAiFriend.data)
        } catch (error) {
          console.error("Failed to ensure AI friend:", error)
          // Don't show error to user, just log it
        }
        
        // Redirect to / after successful login
        router.push("/")
      }



    } catch (error) {
      toast.error("Invalid credentials")
      console.log("Error is : ",error)
    } finally {
      setLoading(false)
    }
  }
  
  // This function validates all fields and shows all errors at once
  const handleFormSubmit = (e) => {
    e.preventDefault()
    // Trigger validation for all fields before submission
    form.trigger(["email", "password"]).then((isValid) => {
      if (isValid) {
        form.handleSubmit(onSubmit)(e)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden w-full max-w-md">
        <div className="p-6 sm:p-8">
          {/* Header with Logo */}
          <div className="flex flex-col items-center justify-center mb-8">
            <div className="bg-blue-600 rounded-full p-3 mb-4">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="white" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Welcome Back</h1>
            <p className="text-gray-500 mt-1">Sign in to your account</p>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">Email</FormLabel>
                    <div className="relative">
                      <div className="absolute left-3 top-3 text-gray-400">
                        <FiMail size={18} />
                      </div>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter your email"
                          className="pl-10 py-2 border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 transition duration-200 rounded-lg"
                          {...field}
                          autoComplete="email"
                        />
                      </FormControl>
                    </div>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700">Password</FormLabel>
                    <div className="relative">
                      <div className="absolute left-3 top-3 text-gray-400">
                        <FiLock size={18} />
                      </div>
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="pl-10 py-2 border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 transition duration-200 rounded-lg"
                          {...field}
                          autoComplete="current-password"
                        />
                      </FormControl>
                      <button
                        type="button"
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                      </button>
                    </div>
                    <FormMessage className="text-red-500" />
                  </FormItem>
                )}
              />
              
              

              <Button
                type="submit"
                className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors duration-300 flex items-center justify-center"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
              
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or continue with</span>
                </div>
              </div>
              
              <Button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 py-2 px-4 rounded-lg font-medium flex items-center justify-center shadow-sm transition-all"
              >
                {isGoogleLoading ? (
                  <div className="h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <FaGoogle className="text-red-500 mr-2" />
                )}
                Sign in with Google
              </Button>
              
              <p className="text-center text-sm text-gray-600 mt-4">
                Don't have an account?{" "}
                <Link href="/sign-up" className="font-medium text-blue-600 hover:text-blue-500 transition-colors">
                  Sign up
                </Link>
              </p>
            </form>
          </Form>
        </div>
      </div>
    </div>
  )
}

export default SignInPage