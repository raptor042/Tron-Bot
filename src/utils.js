import { getUser } from "./db/db.js"

export const isUser = async (userId) => {
    const user = await getUser(userId)
    console.log(user)

    return user ? true : false
}