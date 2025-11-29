"use client";

import { useEffect, useRef, useState, Suspense } from "react";
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

/* ----------------------------- CUSTOM DEBOUNCE HOOK ----------------------------- */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/* ----------------------------- MAIN INNER LOGIC ----------------------------- */
function SignUpInner() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
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
  const [emailMessage, setEmailMessage] = useState("");
  
  // Debounce values for API calls (not state updates)
  const debouncedUsername = useDebounce(username, 500);
  const debouncedEmail = useDebounce(email, 500);
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
      // Only check if debounced username has value and matches current username
      if (!debouncedUsername || debouncedUsername !== username) {
        return;
      }

      if (debouncedUsername.length < 3) {
          form.setError("username", {
            type: "manual",
            message: "Username must be of 3 or above characters",
          });
          setUsernameMessage("");
        setUsernameLoading(false);
          return;
        }

      if (!/^[a-z A-Z_]+$/.test(debouncedUsername)) {
          form.setError("username", {
            type: "manual",
            message: "Username can't have digits or special chars",
          });
          setUsernameMessage("");
        setUsernameLoading(false);
          return;
        }

        form.clearErrors("username");
        setUsernameLoading(true);
      
        try {
          const response = await axios.post(
          `/api/unique-username?username=${debouncedUsername}`
          );
          setUsernameMessage(response.data.message);
        } catch (error) {
          if (error instanceof AxiosError) {
          setUsernameMessage(error.response?.data?.message || "Error checking username");
          }
        } finally {
          setUsernameLoading(false);
        }
    };

    if (debouncedUsername) {
      checkUsername();
      } else {
        form.clearErrors("username");
        setUsernameMessage("");
      setUsernameLoading(false);
      }
  }, [debouncedUsername, username, form]);

  /* ------------------------------- Email Check ------------------------------ */
  useEffect(() => {
    const checkEmail = async () => {
      // Only check if debounced email has value and matches current email
      if (!debouncedEmail || debouncedEmail !== email || debouncedEmail.trim().length === 0) {
        setEmailMessage("");
        return;
      }

      const trimmedEmail = debouncedEmail.trim();
      if (trimmedEmail.length === 0) {
        setEmailMessage("");
        return;
      }

      // Basic email validation before API call
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
      setEmailMessage("");
      return;
    }

      setEmailMessage("");
      
        try {
        const response = await axios.post("/api/check-email", { email: trimmedEmail });
        setEmailMessage(response?.data?.message || "");
        } catch (error) {
          if (error instanceof AxiosError) {
          setEmailMessage(error.response?.data?.message || "Error checking email");
        }
      }
    };

    checkEmail();
  }, [debouncedEmail, email]);

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
      emailMessage.includes("can register") &&
      !emailMessage.includes("already registered") &&
      !emailMessage.includes("Invalid email")
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
      setOtpExpired(false);
      setTimeLeft(60);
      setStartTimer(false);
      // Start timer after a brief delay to ensure state is updated
      setTimeout(() => {
        setStartTimer(true);
      }, 100);
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

  /* ------------------------------- Resend OTP Function ------------------------------ */
  const handleResendOtp = async () => {
    try {
      const code = generateOtp();
      setConfirmLoading(true);
      await axios.post("/api/send-otp", {
        username,
        email,
        otp: otpRef.current,
      });
      toast.success("OTP resent successfully");
      // Reset timer and state
      setOtpExpired(false);
      setTimeLeft(60);
      setStartTimer(false);
      // Clear OTP input
      setOtp("");
      setDisableSignUp(true);
      // Restart timer after a brief delay
      setTimeout(() => {
        setStartTimer(true);
      }, 100);
    } catch (error) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message || "Failed to resend OTP");
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  /* ------------------------------- Timer Logic ------------------------------ */
  useEffect(() => {
    let timer = null;
    if (startTimer && !otpExpired) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setOtpExpired(true);
            otpRef.current = "";
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [startTimer, otpExpired]);

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
                <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">Create Account</h1>
                <p className="text-gray-600 mt-1 font-medium">Sign up to Chatly</p>
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
                        className="w-32 h-32 rounded-full object-cover border-4 border-indigo-200 shadow-lg"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-indigo-100 flex items-center justify-center border-4 border-indigo-200 shadow-lg">
                        <UserIcon className="w-16 h-16 text-indigo-400" />
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
                    {profilePicturePreview ? (
                      <>
                        {/* Update Button */}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={fieldsDisabled}
                          className="absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-110 z-10"
                          title="Update image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                        {/* Remove Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setProfilePicture(null);
                            setProfilePicturePreview(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = "";
                            }
                          }}
                          disabled={fieldsDisabled}
                          className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-110 z-10"
                          title="Remove image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={fieldsDisabled}
                        className="absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 transition-colors shadow-lg"
                        title="Upload image"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Click to upload profile picture (optional)</p>
                </div>
              )}
  
              {!showOtp ? (
                /* ----------------------------- Sign Up Form ----------------------------- */
                <div className="space-y-5">
                  {/* Username Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Enter username (letters only)"
                        value={username}
                        onChange={(e) => {
                          // Only allow letters, spaces, and underscores
                          const value = e.target.value;
                          const filteredValue = value.replace(/[^a-zA-Z _]/g, '');
                          setUsername(filteredValue);
                        }}
                        onKeyDown={(e) => {
                          // Prevent numbers and special characters from being typed
                          const key = e.key;
                          // Allow: letters, space, underscore, backspace, delete, arrow keys, tab
                          if (!/^[a-zA-Z _]$/.test(key) && 
                              !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab', 'Home', 'End'].includes(key) &&
                              !(e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                          }
                        }}
                        onPaste={(e) => {
                          // Filter pasted content to only allow letters, spaces, and underscores
                          e.preventDefault();
                          const pastedText = e.clipboardData.getData('text');
                          const filteredText = pastedText.replace(/[^a-zA-Z _]/g, '');
                          setUsername(filteredText);
                        }}
                        disabled={fieldsDisabled}
                        className="w-full pl-3 pr-3 py-2.5 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg transition-all"
                      />
                      {usernameLoading && (
                        <div className="absolute right-3 top-2.5">
                          <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    {usernameMessage && (
                      <p className={`text-xs mt-1.5 font-medium ${usernameMessage.includes("Username is available") ? "text-green-600" : "text-red-600"}`}>
                        {usernameMessage}
                      </p>
                    )}
                  </div>
  
                  {/* Email Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <div className="relative">
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={fieldsDisabled}
                        className="w-full pl-3 pr-3 py-2.5 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg transition-all"
                      />
                    </div>
                    {emailMessage && (
                      <p className={`text-xs mt-1.5 font-medium ${
                        emailMessage.includes("can register") && 
                        !emailMessage.includes("already registered") && 
                        !emailMessage.includes("Invalid email")
                          ? "text-green-600" 
                          : "text-red-600"
                      }`}>
                        {emailMessage}
                      </p>
                    )}
                  </div>
  
                  {/* Password Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={fieldsDisabled}
                        className="w-full pl-3 pr-10 py-2.5 border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg transition-all"
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
                    {password && (
                      <div className="mt-3 space-y-1.5 bg-gray-50 p-3 rounded-lg">
                        <div className={`flex items-center text-xs ${lengthChecked ? "text-green-600" : "text-gray-500"}`}>
                          <span className="mr-2 font-bold">{lengthChecked ? "✓" : "○"}</span>
                          <span>At least 6 characters</span>
                        </div>
                        <div className={`flex items-center text-xs ${oneChecked ? "text-green-600" : "text-gray-500"}`}>
                          <span className="mr-2 font-bold">{oneChecked ? "✓" : "○"}</span>
                          <span>Uppercase and lowercase letters</span>
                        </div>
                        <div className={`flex items-center text-xs ${twoChecked ? "text-green-600" : "text-gray-500"}`}>
                          <span className="mr-2 font-bold">{twoChecked ? "✓" : "○"}</span>
                          <span>At least one number</span>
                        </div>
                        <div className={`flex items-center text-xs ${threeChecked ? "text-green-600" : "text-gray-500"}`}>
                          <span className="mr-2 font-bold">{threeChecked ? "✓" : "○"}</span>
                          <span>At least one special character</span>
                        </div>
                      </div>
                    )}
                  </div>
  
                  {/* Confirm Button */}
                  <Button
                    type="button"
                    onClick={onConfirmClick}
                    disabled={enableConfirm || confirmLoading || fieldsDisabled}
                    className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {confirmLoading ? (
                      <span className="flex items-center justify-center">
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Sending OTP...
                      </span>
                    ) : (
                      "Confirm & Send OTP"
                    )}
                  </Button>
  
                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-gray-500">Or continue with</span>
                    </div>
                  </div>
  
                  {/* Google Sign Up Button */}
                  <Button
                    type="button"
                    onClick={handleGoogleSignUp}
                    disabled={isGoogleLoading || fieldsDisabled}
                    className="w-full bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 py-2.5 rounded-lg flex items-center justify-center shadow-sm transition-all font-medium"
                  >
                    {isGoogleLoading ? (
                      <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                    ) : (
                      <FaGoogle className="text-red-500 mr-2 text-lg" />
                    )}
                    Sign up with Google
                  </Button>
  
                  <p className="text-center text-sm text-gray-600 mt-5">
                    Already have an account?{" "}
                    <Link href="/sign-in" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
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
  
                  <div className="flex flex-col items-center gap-2">
                    {!otpExpired ? (
                      <p className="text-center text-sm">
                        Code expires in: <strong className="text-red-600 font-bold text-base">{timeLeft}s</strong>
                      </p>
                    ) : (
                      <p className="text-sm text-red-600 font-medium">OTP expired</p>
                    )}
                    
                    <p className="text-center text-sm text-gray-600">
                      Don't get code?{" "}
                      {confirmLoading ? (
                        <span className="text-indigo-500">Resending...</span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={confirmLoading}
                          className="text-indigo-600 hover:text-indigo-700 font-medium underline hover:no-underline transition-all"
                        >
                          Resend code
                        </button>
                      )}
                    </p>
                  </div>
  
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
