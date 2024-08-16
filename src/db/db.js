import { connect } from "mongoose"
import { config } from "dotenv"
import { UserModel } from "./models/models.js"

config()

const URI = process.env.MONGO_URI

export const connectDB = async () => {
    try {
        await connect(`${URI}`)
        console.log("Connection to the Database was successful.")
    } catch(err) {
        console.log(err)
    }
}

export const getUser = async (userId) => {
    try {
        const user = await UserModel.findOne({ userId })

        return user
    } catch (err) {
        console.log(err)
    }
}

export const getUsers = async () => {
    try {
        const users = await UserModel.find()

        return users
    } catch (err) {
        console.log(err)
    }
}

export const createUser = async (userId, username, pubKey, secKey) => {
    try {
        const user = new UserModel({
            userId,
            username,
            pubKey,
            secKey,
            trades: []
        })

        const data = await user.save()

        return data
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTrades = async (
    userId,
    token,
    base,
    quote,
    price,
    base_amount,
    quote_amount,
    take_profit,
    stop_loss,
    bought_at,
) => {
    try {
        const trade = {
            token,
            base,
            quote,
            price,
            base_amount,
            quote_amount,
            take_profit,
            stop_loss,
            bought_at,
            sold_at: 0,
            sold: false
        }

        const user = await UserModel.findOneAndUpdate(
            { userId }, 
            { $push: { trades: trade } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserTradeTime = async (userId, bought_at, timestamp) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, trades : { $elemMatch : { bought_at } } },
            { $set : { "trades.$.sold_at" : timestamp } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const deleteUser = async (userId) => {
    try {
        const user = await UserModel.deleteOne({ userId })

        return user
    } catch (err) {
        console.log(err)
    }
}