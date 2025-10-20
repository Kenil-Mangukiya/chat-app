"use client"

import { useEffect, useRef, useState } from "react"
import { useDebounceCallback } from "usehooks-ts"
import axios, { AxiosError } from "axios"
import { FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { signupSchema } from "@/schema/sign-up-schema"
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from "next/navigation"
import { FaGoogle, FaEye, FaEyeSlash, FaCheck, FaTimes } from "react-icons/fa"
import { motion } from "framer-motion"

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "react-toastify"
import Link from "next/link"
import { UserIcon } from "lucide-react"

function SignUpPage() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [usernameMessage, setUsernameMessage] = useState("")
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const debouncedUsername = useDebounceCallback(setUsername, 300)
  const [oneChecked, setOneChecked] = useState(false)
  const [twoChecked, setTwoChecked] = useState(false)
  const [threeChecked, setThreeChecked] = useState(false)
  const [finalChecked, setFinalChecked] = useState(false)
  const [enableConfirm, setEnableConfirm] = useState(true)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [showOtp, setShowOtp] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60) // Initial time set to 60 seconds
  const [otpExpired, setOtpExpired] = useState(false)
  const [startTimer, setStartTimer] = useState(false)
  const [disableSignUp, setDisableSignUp] = useState(true)
  const [otp, setOtp] = useState("")
  const [otpError, setOtpError] = useState("")
  const otpRef = useRef("")
  const fileInputRef = useRef(null)
  const debouncedEmail = useDebounceCallback(setEmail, 300)
  const [emailMessage, setEmailMessage] = useState("")
  const [lengthChecked, setLengthChecked] = useState(false)
  const [googleAuthMessage, setGoogleAuthMessage] = useState("")
  const [googleAuthError, setGoogleAuthError] = useState("")
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [profilePicture, setProfilePicture] = useState(null)
  const [profilePicturePreview, setProfilePicturePreview] = useState(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      otp: ""
    }
  })

  useEffect(() => {
    // Check for message or error in URL parameters for Google Auth feedback
    const msgParam = searchParams.get("message")
    const errorParam = searchParams.get("error")
    
    if (msgParam) {
      switch (msgParam) {
        case "account_linked":
          setGoogleAuthMessage("This Google account is already linked to an existing account. Please sign in instead.");
          break;
        case "account_created":
          setGoogleAuthMessage("Your account has been created successfully! You can now sign in.");
          router.push("/signin");
          break;
        default:
          setGoogleAuthMessage("");
      }
    }
    
    if (errorParam) {
      switch (errorParam) {
        case "signup_failed":
          setGoogleAuthError("Account creation failed. Please try again.");
          break;
        case "OAuthAccountNotLinked":
          setGoogleAuthError("An account with this email already exists. Please sign in instead.");
          break;
        default:
          setGoogleAuthError("");
      }
    }
  }, [searchParams, router]);

  useEffect(() => {
    setUsernameMessage("")
    const checkUsername = async () => {
      if (username) {
        setUsernameLoading(true)
        try {
          const response = await axios.post(`/api/unique-username?username=${username}`)
          setUsernameMessage(response.data.message)
        }
        catch (error) {
          if (error instanceof AxiosError) {
            setUsernameMessage(error.response.data.message)
          }
        }
        finally {
          setUsernameLoading(false)
        }
      }
    }

    checkUsername()
  }, [username])

  useEffect(() => {
    const trimmedEmail = email.trim()
    if (trimmedEmail.length == 0) {
      setEmailMessage("")
      return
    }
    const checkEmail = async () => {
      if (email) {
        try {
          setEmailMessage("")
          const response = await axios.post("/api/check-email", { email: email })
          setEmailMessage(response?.data?.message)
        }
        catch (error) {
          if (error instanceof AxiosError) {
            setEmailMessage(error.response.data.message)
          }
        }
      }
    }
    checkEmail()
  }, [email])

  useEffect(() => {
    const passwordValidation = () => {
      const hasUpperAndLower = /(?=.*[a-z])(?=.*[A-Z])/.test(password);
      const hasNumbers = /(?=.*\d)/.test(password);
      const hasSpecialChars = /(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password);
      const checkLength = password.length > 5

      setOneChecked(hasUpperAndLower)
      setTwoChecked(hasNumbers)
      setThreeChecked(hasSpecialChars)
      setLengthChecked(checkLength)

      if (checkLength && hasUpperAndLower && hasNumbers && hasSpecialChars) {
        setFinalChecked(true);
      }
      else {
        setFinalChecked(false);
      }
    }

    passwordValidation()
  }, [password])

  const enableConfirmButton = () => {
    setEnableConfirm(true)
    if (usernameMessage.includes("Username is available") && email.includes('@') && email.includes('.') && emailMessage.includes("can register")) {
      setEnableConfirm(false)
    }
  }

  useEffect(() => {
    enableConfirmButton()
  }, [username, email, password, usernameMessage, emailMessage])

  const generateOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000)
    otpRef.current = code
    return code
  }

  const onConfirmClick = async () => {
    // Validate password before sending OTP
    const passwordValidation = () => {
      const hasUpperAndLower = /(?=.*[a-z])(?=.*[A-Z])/.test(password);
      const hasNumbers = /(?=.*\d)/.test(password);
      const hasSpecialChars = /(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password);
      const checkLength = password.length > 5

      if (!checkLength) {
        toast.error("Password must be at least 6 characters long")
        return false
      }
      if (!hasUpperAndLower) {
        toast.error("Password must contain both uppercase and lowercase letters")
        return false
      }
      if (!hasNumbers) {
        toast.error("Password must contain at least one number")
        return false
      }
      if (!hasSpecialChars) {
        toast.error("Password must contain at least one special character")
        return false
      }
      return true
    }

    if (!passwordValidation()) {
      return
    }

    try {
      const code = generateOtp()
      console.log("code is : ",code)
      setConfirmLoading(true)
      const response = await axios.post("/api/send-otp", {
        username, email, otp: otpRef.current
      })
      toast.success("OTP sent successfully")
      setShowOtp(true)
      setStartTimer(true)
    }
    catch (error) {
      setShowOtp(false)
      if (error instanceof AxiosError) {
        toast.error(error.response.data.message)
      }
    }
    finally {
      setConfirmLoading(false)
    }
  }

  useEffect(() => {
    if (startTimer) {
      // Start a timer when the component is mounted
      const timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          // If time is less than or equal to 0, stop the countdown and mark OTP as expired
          if (prevTime <= 1) {
            clearInterval(timer);
            setOtpExpired(true); // OTP expired
            otpRef.current = ""
            return 0;
          }
          return prevTime - 1; // Decrease time by 1 second
        });
      }, 1000); // Update every 1000ms (1 second)

      // Cleanup function to clear the interval on unmount
      return () => clearInterval(timer);
    }
  }, [startTimer]);

  useEffect(() => {
    if (otp.length == 6) {
      setDisableSignUp(false)
    }
    else {
      setOtpError("")
      setDisableSignUp(true)
    }
  }, [otp])

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setProfilePicture(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setProfilePicturePreview(e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeProfilePicture = () => {
    setProfilePicture(null)
    setProfilePicturePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      setIsGoogleLoading(true)
      await signIn("google", { callbackUrl: "/ui" })
    } catch (error) {
      console.error("Google sign-in error:", error)
      toast.error("Google sign-up failed. Please try again.")
    } finally {
      setIsGoogleLoading(false)
    }
  }

  const onSubmit = async (data) => {
    if (otpRef.current == otp) {
      try {
        setOtpError("")
        setSubmitLoading(true)
        
        // Create FormData to handle file upload
        const formData = new FormData()
        formData.append('username', username)
        formData.append('email', email)
        formData.append('password', password)
        formData.append('otp', otpRef.current)
        if (profilePicture) {
          formData.append('profilePicture', profilePicture)
        }
        
        const response = await axios.post("/api/sign-up", formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
        toast.success(response.data.message || "User registered successfully")
        // Redirect to signin page after successful registration
        router.push("/sign-in")
      }
      catch (error) {
        if (error instanceof AxiosError) {
          setUsernameMessage(error.response.data.message)
        }
      }
      finally {
        setSubmitLoading(false)
      }
    }
    else {
      setOtpError("Invalid OTP")
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 space-y-8 transform transition-all duration-300 hover:shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500">Create Your Account</h1>
          <p className="mt-2 text-sm text-gray-600">Join us today and unlock all features!</p>
        </div>

        {(googleAuthMessage || googleAuthError) && (
          <div className={`p-4 rounded-lg ${googleAuthMessage ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"} mb-4`}>
            <p>{googleAuthMessage || googleAuthError}</p>
          </div>
        )}

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Picture Field */}
            <div className="space-y-4">
              <label className="text-gray-700 font-medium ml-28 mb-4">Profile Picture (Optional)</label>
              <div className="flex flex-col items-center space-y-4">
                {profilePicturePreview ? (
                  <div className="relative">
                    <img
                      src={profilePicturePreview}
                      alt="Profile preview"
                      className="w-24 h-24 rounded-full object-cover border-4 border-indigo-200 shadow-lg"
                    />
                    <button
                      type="button"
                      onClick={removeProfilePicture}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {username ? username.charAt(0).toUpperCase() : <UserIcon size={24} />}
                  </div>
                )}
                <div className="flex flex-col items-center space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="hidden"
                    id="profile-picture"
                  />
                  <label
                    htmlFor="profile-picture"
                    className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-200 transition-colors font-medium"
                  >
                    {profilePicture ? 'Change Picture' : 'Choose Picture'}
                  </label>
                  {profilePicture && (
                    <p className="text-xs text-gray-500 text-center">
                      {profilePicture.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Username</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Enter username"
                        className="pl-3 pr-10 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          debouncedUsername(e.target.value)
                        }}
                      />
                    </FormControl>
                    {usernameLoading && (
                      <div className="absolute right-3 top-3">
                        <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  <FormMessage className="text-red-500 text-sm" />
                  {usernameMessage && (
                    <p className={`text-sm mt-1 ${usernameMessage?.includes("is available") ? "text-green-500" : "text-red-500"}`}>
                      {usernameMessage}
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter email"
                      className="pl-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        setEmail(e.target.value)
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-red-500 text-sm" />
                  {emailMessage.length > 0 && (
                    <p className={`text-sm mt-1 ${emailMessage?.includes("can register") ? "text-green-500" : "text-red-500"}`}>
                      {emailMessage}
                    </p>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-700 font-medium">Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        className="pl-3 pr-10 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          setPassword(e.target.value)
                        }}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                  <FormMessage className="text-red-500 text-sm" />
                </FormItem>
              )}
            />


            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="button"
                onClick={onConfirmClick}
                disabled={enableConfirm || confirmLoading}
                className={`w-full py-2 px-4 rounded-lg font-medium text-white ${
                  enableConfirm
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md hover:shadow-lg transition-all"
                }`}
              >
                {confirmLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Sending OTP...
                  </div>
                ) : (
                  "Send Verification Code"
                )}
              </Button>
            </motion.div>

            {showOtp && (
              <div className="space-y-4 animate-fadeIn">
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Enter Verification Code</h3>
                  <p className="text-xs text-gray-500 mb-4">A 6-digit code has been sent to your email address</p>
                </div>

                <FormField
                  control={form.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormControl>
                        <InputOTP
                          maxLength={6}
                          pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                          value={field.value}
                          onChange={(val) => {
                            field.onChange(val)
                            setOtp(val)
                          }}
                          className="flex justify-center gap-2"
                        >
                          <InputOTPGroup>
                            {Array.from({ length: 6 }).map((_, i) => (
                              <InputOTPSlot 
                                key={i} 
                                index={i} 
                                className="w-10 h-12 border-2 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                              />
                            ))}
                          </InputOTPGroup>
                        </InputOTP>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="text-center">
                  <p className={`text-sm ${otpExpired ? "text-red-500" : "text-indigo-600"}`}>
                    {otpExpired ? "Code expired. Please request a new one." : `Code expires in ${timeLeft}s`}
                  </p>
                  {otpError.length > 0 && (
                    <p className="text-sm text-red-500 mt-1">{otpError}</p>
                  )}
                </div>

                {otpExpired && (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      type="button"
                      onClick={onConfirmClick}
                      className="w-full py-2 px-4 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg font-medium transition-all"
                    >
                      Resend Code
                    </Button>
                  </motion.div>
                )}

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    disabled={disableSignUp || submitLoading}
                    className={`w-full py-2 px-4 rounded-lg font-medium text-white ${
                      disableSignUp
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md hover:shadow-lg transition-all"
                    }`}
                  >
                    {submitLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Creating Account...
                      </div>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </motion.div>
              </div>
            )}

            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="flex-shrink mx-4 text-gray-400 text-sm">or</span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="button"
                onClick={handleGoogleSignUp}
                disabled={isGoogleLoading}
                className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 py-2 px-4 rounded-lg font-medium flex items-center justify-center shadow-sm transition-all"
              >
                {isGoogleLoading ? (
                  <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <FaGoogle className="text-red-500 mr-2" />
                )}
                Sign Up with Google
              </Button>
            </motion.div>

            <div className="text-center text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign In
              </Link>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  )
}

export default SignUpPage