import {z} from "zod"

export const emailValidation = z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z
      .string()
      .email({ message: "Enter valid email id" })  
  )

export const passwordValidation = z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z
      .string() 
  )

export const signinSchema = z.object({
    email : emailValidation,
    password : passwordValidation
})

