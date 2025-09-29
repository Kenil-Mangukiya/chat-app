import {z} from "zod"

export const usernameValidation = 
z
.string()
.min(3,"Username must be of 3 or above characters")
.regex(/^[a-z A-Z_]+$/,"Username can't have digit and special chars")

export const emailValidation = 
z
.string()
.email()

export const passwordValidation = 
z
.string()

export const signupSchema = z.object({
    username : usernameValidation,
    email : emailValidation,
    password : passwordValidation
})

