import {z} from "zod"

export const contentValidation = 
z
.string({message:"Content should be in string"})


export const messageSchema = z.object({
    content : contentValidation
})