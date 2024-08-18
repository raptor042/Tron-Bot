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

export const getUserTradeByMsg = async (userId, message_id) => {
    try {
        const user = await UserModel.findOne(
            { userId, trades : { $elemMatch : { message_id } } }
        )

        return user.trades
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
            referrals: 0,
            trades: [],
            settings: {
                buy_with: 0,
                auto_buy: false,
                sell_at: 0,
                auto_sell: false,
            }
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
    bought_at,
    message_id
) => {
    try {
        const trade = {
            token,
            base,
            quote,
            price,
            base_amount,
            quote_amount,
            bought_at,
            pNl: 0,
            sold_at: 0,
            sold: false,
            message_id
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

export const updateUserTrade = async (userId, bought_at, timestamp, pnl) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId, trades : { $elemMatch : { bought_at } } },
            { $set : { "trades.$.sold_at" : timestamp, "trades.$.sold": true, "trades.$.pNl": pnl } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserWallet = async (userId, pubKey, secKey) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId },
            { $set : { pubKey, secKey } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserReferrals = async (userId) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId },
            { $inc : { referrals } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserAutoBuySetting = async (userId, buy) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId },
            { $set : { "settings.auto_buy": buy } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserAutoSellSetting = async (userId, sell) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId },
            { $set : { "settings.auto_sell": sell } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserBuyWithSetting = async (userId, buy) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId },
            { $set : { "settings.buy_with": buy } }
        )

        return user
    } catch (err) {
        console.log(err)
    }
}

export const updateUserSellAtSetting = async (userId, sell) => {
    try {
        const user = await UserModel.findOneAndUpdate(
            { userId },
            { $set : { "settings.sell_at": sell } }
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