import { Schema, model } from "mongoose";

const UserSchema = new Schema({
    username: String,
    userId: { type : Number, required : true },
    pubKey: String,
    secKey: String,
    referrals: Number,
    trades: [ 
        {
            token: String,
            base: String,
            quote: String,
            price: Number,
            base_amount: Number,
            quote_amount: Number,
            pNl: Number,
            bought_at: Number,
            sold_at: Number,
            sold: Boolean,
            message_id: Number,
        }
    ],
    settings: {
        buy_with: Number,
        auto_buy: Boolean,
        sell_at: Number,
        auto_sell: Boolean
    }
})

export const UserModel = model("User", UserSchema)