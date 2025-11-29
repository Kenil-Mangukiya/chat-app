"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useDebounceCallback } from "usehooks-ts";
import axios, { AxiosError } from "axios";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema } from "@/schema/sign-up-schema";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaGoogle, FaEye, FaEyeSlash } from "react-icons/fa";
import { motion } from "framer-motion";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "react-toastify";
import Link from "next/link";
import { UserIcon } from "lucide-react";

/* ----------------------------- MAIN INNER LOGIC ----------------------------- */
function SignUpInner() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const debouncedUsername = useDebounceCallback(setUsername, 300);
  const [oneChecked, setOneChecked] = useState(false);
  const [twoChecked, setTwoChecked] = useState(false);
  const [threeChecked, setThreeChecked] = useState(false);
  const [finalChecked, setFinalChecked] = useState(false);
  const [enableConfirm, setEnableConfirm] = useState(true);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [otpExpired, setOtpExpired] = useState(false);
  const [startTimer, setStartTimer] = useState(false);
  const [disableSignUp, setDisableSignUp] = useState(true);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const otpRef = useRef("");
  const fileInputRef = useRef(null);
  const debouncedEmail = useDebounceCallback(setEmail, 300);
  const [emailMessage, setEmailMessage] = useState("");
  const [lengthChecked, setLengthChecked] = useState(false);
  const [googleAuthMessage, setGoogleAuthMessage] = useState("");
  const [googleAuthError, setGoogleAuthError] = useState("");
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(null);
  const [fieldsDisabled, setFieldsDisabled] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const form = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      otp: "",
    },
  });

  /* -------------------------- Google Auth Message -------------------------- */
  useEffect(() => {
    const msgParam = searchParams.get("message");
    const errorParam = searchParams.get("error");

    if (msgParam) {
      switch (msgParam) {
        case "account_linked":
          setGoogleAuthMessage(
            "This Google account is already linked to an existing account. Please sign in instead."
          );
          break;
        case "account_created":
          setGoogleAuthMessage(
            "Your account has been created successfully! You can now sign in."
          );
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
          setGoogleAuthError(
            "An account with this email already exists. Please sign in instead."
          );
          break;
        default:
          setGoogleAuthError("");
      }
    }
  }, [searchParams, router]);

  /* ----------------------------- Username Check ----------------------------- */
  useEffect(() => {
    const checkUsername = async () => {
      if (username) {
        if (username.length < 3) {
          form.setError("username", {
            type: "manual",
            message: "Username must be of 3 or above characters",
          });
          setUsernameMessage("");
          return;
        }

        if (!/^[a-z A-Z_]+$/.test(username)) {
          form.setError("username", {
            type: "manual",
            message: "Username can't have digits or special chars",
          });
          setUsernameMessage("");
          return;
        }

        form.clearErrors("username");
        setUsernameLoading(true);
        try {
          const response = await axios.post(
            `/api/unique-username?username=${username}`
          );
          setUsernameMessage(response.data.message);
        } catch (error) {
          if (error instanceof AxiosError) {
            setUsernameMessage(error.response.data.message);
          }
        } finally {
          setUsernameLoading(false);
        }
      } else {
        form.clearErrors("username");
        setUsernameMessage("");
      }
    };

    checkUsername();
  }, [username, form]);

  /* ------------------------------- Email Check ------------------------------ */
  useEffect(() => {
    const trimmedEmail = email.trim();
    if (trimmedEmail.length == 0) {
      setEmailMessage("");
      return;
    }
    const checkEmail = async () => {
      if (email) {
        try {
          setEmailMessage("");
          const response = await axios.post("/api/check-email", { email });
          setEmailMessage(response?.data?.message);
        } catch (error) {
          if (error instanceof AxiosError) {
            setEmailMessage(error.response.data.message);
          }
        }
      }
    };
    checkEmail();
  }, [email]);

  /* --------------------------- Password Validation -------------------------- */
  useEffect(() => {
    const passwordValidation = () => {
      const hasUpperAndLower = /(?=.*[a-z])(?=.*[A-Z])/.test(password);
      const hasNumbers = /(?=.*\d)/.test(password);
      const hasSpecialChars = /(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password);
      const checkLength = password.length > 5;

      setOneChecked(hasUpperAndLower);
      setTwoChecked(hasNumbers);
      setThreeChecked(hasSpecialChars);
      setLengthChecked(checkLength);
      setFinalChecked(
        checkLength && hasUpperAndLower && hasNumbers && hasSpecialChars
      );
    };
    passwordValidation();
  }, [password]);

  const enableConfirmButton = () => {
    setEnableConfirm(true);
    if (
      usernameMessage.includes("Username is available") &&
      email.includes("@") &&
      email.includes(".") &&
      emailMessage.includes("can register")
    ) {
      setEnableConfirm(false);
    }
  };

  useEffect(() => {
    enableConfirmButton();
  }, [username, email, password, usernameMessage, emailMessage]);

  /* ------------------------------ OTP Functions ----------------------------- */
  const generateOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000);
    otpRef.current = code;
    return code;
  };

  const onConfirmClick = async () => {
    const usernameValidation = () => {
      if (!username || username.length < 3) {
        form.setError("username", {
          type: "manual",
          message: "Username must be of 3 or above characters",
        });
        return false;
      }
      if (!/^[a-z A-Z_]+$/.test(username)) {
        form.setError("username", {
          type: "manual",
          message: "Username can't have digits or special chars",
        });
        return false;
      }
      form.clearErrors("username");
      return true;
    };

    const passwordValidation = () => {
      const hasUpperAndLower = /(?=.*[a-z])(?=.*[A-Z])/.test(password);
      const hasNumbers = /(?=.*\d)/.test(password);
      const hasSpecialChars = /(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password);
      const checkLength = password.length > 5;

      if (!checkLength) {
        toast.error("Password must be at least 6 characters long");
        return false;
      }
      if (!hasUpperAndLower) {
        toast.error("Password must contain uppercase and lowercase letters");
        return false;
      }
      if (!hasNumbers) {
        toast.error("Password must contain at least one number");
        return false;
      }
      if (!hasSpecialChars) {
        toast.error("Password must contain at least one special character");
        return false;
      }
      return true;
    };

    if (!usernameValidation() || !passwordValidation()) return;

    try {
      const code = generateOtp();
      console.log("code is : ", code);
      setConfirmLoading(true);
      await axios.post("/api/send-otp", {
        username,
        email,
        otp: otpRef.current,
      });
      toast.success("OTP sent successfully");
      setShowOtp(true);
      setStartTimer(true);
      setFieldsDisabled(true);
    } catch (error) {
      setShowOtp(false);
      if (error instanceof AxiosError) {
        toast.error(error.response.data.message);
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  /* ------------------------------- Timer Logic ------------------------------ */
  useEffect(() => {
    if (startTimer) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setOtpExpired(true);
            otpRef.current = "";
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [startTimer]);

  useEffect(() => {
    if (otp.length == 6) {
      setDisableSignUp(false);
    } else {
      setOtpError("");
      setDisableSignUp(true);
    }
  }, [otp]);

  /* ----------------------------- Google Sign Up ----------------------------- */
  const handleGoogleSignUp = async () => {
    try {
      setIsGoogleLoading(true);
      await signIn("google", { callbackUrl: "/chat" });
    } catch (error) {
      console.error("Google sign-in error:", error);
      toast.error("Google sign-up failed. Please try again.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  /* ----------------------------- Submit Function ---------------------------- */
  const onSubmit = async () => {
    if (otpRef.current == otp) {
      try {
        setOtpError("");
        setSubmitLoading(true);
        const formData = new FormData();
        formData.append("username", username);
        formData.append("email", email);
        formData.append("password", password);
        formData.append("otp", otpRef.current);
        if (profilePicture) formData.append("profilePicture", profilePicture);

        const response = await axios.post("/api/sign-up", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success(response.data.message || "User registered successfully");
        router.push("/sign-in");
      } catch (error) {
        if (error instanceof AxiosError) {
          setUsernameMessage(error.response.data.message);
        }
      } finally {
        setSubmitLoading(false);
      }
    } else {
      setOtpError("Invalid OTP");
    }
  };

  /* ------------------------------- UI Section ------------------------------- */
    /* ------------------------------- UI Section ------------------------------- */
    return (
      <FormProvider {...form}>
        <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden w-full max-w-md">
            <div className="p-6 sm:p-8">
              {/* Header */}
              <div className="flex flex-col items-center justify-center mb-8">
                <div className="bg-indigo-600 rounded-full p-3 mb-4">
                  <UserIcon className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800">Create Account</h1>
                <p className="text-gray-500 mt-1">Sign up to get started</p>
              </div>
  
              {/* Google Auth Messages */}
              {googleAuthMessage && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  {googleAuthMessage}
                </div>
              )}
              {googleAuthError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {googleAuthError}
                </div>
              )}
  
              {/* Profile Picture Upload */}
              {!showOtp && (
                <div className="mb-6 flex flex-col items-center">
                  <div className="relative">
                    {profilePicturePreview ? (
                      <img
                        src={profilePicturePreview}
                        alt="Profile preview"
                        className="w-24 h-24 rounded-full object-cover border-4 border-indigo-200"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center border-4 border-indigo-200">
                        <UserIcon className="w-12 h-12 text-indigo-400" />
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setProfilePicture(file);
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setProfilePicturePreview(reader.result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={fieldsDisabled}
                      className="absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Click to upload profile picture (optional)</p>
                </div>
              )}
  
              {!showOtp ? (
                /* ----------------------------- Sign Up Form ----------------------------- */
                <div className="space-y-4">
                  {/* Username Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Enter username"
                        value={username}
                        onChange={(e) => debouncedUsername(e.target.value)}
                        disabled={fieldsDisabled}
                        className="w-full pl-3 pr-3 py-2 border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 rounded-lg"
                      />
                    </div>
                    {usernameLoading && (
                      <p className="text-xs text-gray-500 mt-1">Checking availability...</p>
                    )}
                    {usernameMessage && (
                      <p className={`text-xs mt-1 ${usernameMessage.includes("available") ? "text-green-600" : "text-red-600"}`}>
                        {usernameMessage}
                      </p>
                    )}
                  </div>
  
                  {/* Email Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => debouncedEmail(e.target.value)}
                        disabled={fieldsDisabled}
                        className="w-full pl-3 pr-3 py-2 border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 rounded-lg"
                      />
                    </div>
                    {emailMessage && (
                      <p className={`text-xs mt-1 ${emailMessage.includes("can register") ? "text-green-600" : "text-red-600"}`}>
                        {emailMessage}
                      </p>
                    )}
                  </div>
  
                  {/* Password Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={fieldsDisabled}
                        className="w-full pl-3 pr-10 py-2 border-gray-300 focus:border-indigo-500 focus:ring focus:ring-indigo-200 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                      </button>
                    </div>
                    
                    {/* Password Validation */}
                    <div className="mt-2 space-y-1">
                      <div className={`flex items-center text-xs ${lengthChecked ? "text-green-600" : "text-gray-500"}`}>
                        <span className={lengthChecked ? "✓" : "○"}>{lengthChecked ? "✓" : "○"}</span>
                        <span className="ml-2">At least 6 characters</span>
                      </div>
                      <div className={`flex items-center text-xs ${oneChecked ? "text-green-600" : "text-gray-500"}`}>
                        <span>{oneChecked ? "✓" : "○"}</span>
                        <span className="ml-2">Uppercase and lowercase letters</span>
                      </div>
                      <div className={`flex items-center text-xs ${twoChecked ? "text-green-600" : "text-gray-500"}`}>
                        <span>{twoChecked ? "✓" : "○"}</span>
                        <span className="ml-2">At least one number</span>
                      </div>
                      <div className={`flex items-center text-xs ${threeChecked ? "text-green-600" : "text-gray-500"}`}>
                        <span>{threeChecked ? "✓" : "○"}</span>
                        <span className="ml-2">At least one special character</span>
                      </div>
                    </div>
                  </div>
  
                  {/* Confirm Button */}
                  <Button
                    type="button"
                    onClick={onConfirmClick}
                    disabled={enableConfirm || confirmLoading || fieldsDisabled}
                    className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition-colors"
                  >
                    {confirmLoading ? "Sending OTP..." : "Confirm & Send OTP"}
                  </Button>
  
                  {/* Divider */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-500">Or continue with</span>
                    </div>
                  </div>
  
                  {/* Google Sign Up Button */}
                  <Button
                    type="button"
                    onClick={handleGoogleSignUp}
                    disabled={isGoogleLoading || fieldsDisabled}
                    className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 py-2 rounded-lg flex items-center justify-center"
                  >
                    {isGoogleLoading ? (
                      <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                    ) : (
                      <FaGoogle className="text-red-500 mr-2" />
                    )}
                    Sign up with Google
                  </Button>
  
                  <p className="text-center text-sm text-gray-600 mt-4">
                    Already have an account?{" "}
                    <Link href="/sign-in" className="font-medium text-indigo-600 hover:text-indigo-500">
                      Sign in
                    </Link>
                  </p>
                </div>
              ) : (
                /* ----------------------------- OTP Verification ----------------------------- */
                <div className="space-y-4">
                  <div className="text-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-800">Verify Your Email</h2>
                    <p className="text-sm text-gray-500 mt-2">
                      We've sent a 6-digit code to <strong>{email}</strong>
                    </p>
                  </div>
  
                  <FormField
                    control={form.control}
                    name="otp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-center block text-gray-700">Enter OTP</FormLabel>
                        <FormControl>
                          <div className="flex justify-center">
                            <InputOTP
                              maxLength={6}
                              value={otp}
                              onChange={(value) => {
                                setOtp(value);
                                field.onChange(value);
                              }}
                              disabled={otpExpired || submitLoading}
                              pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
                            >
                              <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                                <InputOTPSlot index={3} />
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                              </InputOTPGroup>
                            </InputOTP>
                          </div>
                        </FormControl>
                        {otpError && (
                          <p className="text-center text-sm text-red-600 mt-2">{otpError}</p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
  
                  {!otpExpired && (
                    <p className="text-center text-sm text-gray-600">
                      Code expires in: <strong>{timeLeft}s</strong>
                    </p>
                  )}
  
                  {otpExpired && (
                    <div className="text-center">
                      <p className="text-sm text-red-600 mb-2">OTP expired</p>
                      <Button
                        type="button"
                        onClick={onConfirmClick}
                        disabled={confirmLoading}
                        variant="outline"
                        className="w-full"
                      >
                        Resend OTP
                      </Button>
                    </div>
                  )}
  
                  <Button
                    type="button"
                    onClick={onSubmit}
                    disabled={disableSignUp || submitLoading || otpExpired}
                    className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg transition-colors"
                  >
                    {submitLoading ? "Creating Account..." : "Sign Up"}
                  </Button>
  
                  <Button
                    type="button"
                    onClick={() => {
                      setShowOtp(false);
                      setOtp("");
                      setFieldsDisabled(false);
                      setOtpExpired(false);
                      setTimeLeft(60);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Back to Edit
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </FormProvider>
    );
}

/* ------------------------- WRAP WITH SUSPENSE HERE ------------------------- */
export default function SignUpPage() {
  return (
    <Suspense fallback={<div>Loading Sign Up Page...</div>}>
      <SignUpInner />
    </Suspense>
  );
}
