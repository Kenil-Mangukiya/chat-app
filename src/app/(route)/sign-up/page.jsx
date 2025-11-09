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
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-blue-100 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* The rest of your JSX (form, buttons, etc.) stays exactly as before */}
      {/* ✅ Nothing else needs changing */}
    </div>
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
