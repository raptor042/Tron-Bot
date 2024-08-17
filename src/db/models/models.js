import { Schema, model } from "mongoose";

const UserSchema = new Schema({
    username: String,
    userId: { type : Number, required : true },
    pubKey: String,
    secKey: String,
    trades: [ 
        {
            token: String,
            base: String,
            quote: String,
            price: Number,
            base_amount: Number,
            quote_amount: Number,
            take_profit: Number,
            stop_loss: Number,
            pNl: Number,
            bought_at: Number,
            sold_at: Number,
            sold: Boolean
        }
    ]
})

export const UserModel = model("User", UserSchema)