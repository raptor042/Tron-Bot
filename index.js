import { Telegraf, Markup } from "telegraf"
import { config } from "dotenv"
import { connectDB, createUser, getUser, updateUserTrades } from "./src/db/db.js"
import { approve, buy, getAmountsOut, getConnection, getTimestamp, getTokenInfo } from "./src/web3/web3.js"
import { isUser, monitorPrices, toDecimals } from "./src/utils.js"

config()

const URL = process.env.TELEGRAM_BOT_API

const bot = new Telegraf(URL)

bot.use(Telegraf.log())

bot.command("start", async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const is_user = await isUser(ctx.message.from.id)
            console.log(is_user)
    
            if(!is_user) {
                const web3 = getConnection()
                const account = await web3.createAccount()
                console.log(account)
    
                const user = await createUser(
                    ctx.message.from.id,
                    ctx.message.from.username,
                    account.address.base58,
                    account.privateKey
                )
                console.log(user)
    
                await ctx.replyWithHTML(`<i>Hello ${ctx.message.from.username} 👋, </i>\n\n<b>Welcome to the best TRON trading bot where you can buy/sell at light speeds and secure massive profits 💰.</b>\n\n<b>A wallet has been created for you which will be used only for trading, make sure you fund the wallet with TRX and keep the private key safe.</b>\n\n<b>Public Address:</b><i>${account.address.base58}</i>\n\n<b>Private Key:</b><i>${account.privateKey}</i>\n\n<i>Powered by Raptor 👾\n\nBuilt on Tron 🤖.</i>`)
            } else {
                await ctx.replyWithHTML(`<i>Hello ${ctx.message.from.username} 👋, </i>\n\n<b>Welcome to the best TRON trading bot where you can buy/sell at light speeds and secure massive profits 💰.</b>\n\n<i>Powered by Raptor 👾\nBuilt on Tron 🤖.</i>`)
            }
        } else {
            await ctx.reply("⚠️ Bot is only used on private chats.")
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
    }
})

bot.command("buy", async ctx => {
    try { 
        if (ctx.message.chat.type == "private") {
            const is_user = await isUser(ctx.message.from.id)

            if(is_user) {
                console.log(ctx.args)

                if(ctx.args.length == 4) {
                    const tokenInfo = await getTokenInfo(ctx.args[0])
                    console.log(tokenInfo)

                    const timestamp = await getTimestamp()
                    console.log(timestamp)

                    const amountsOut = await getAmountsOut(ctx.args[0], ctx.args[1])
                    console.log(amountsOut)

                    const user = await getUser(ctx.message.from.id)
                    console.log(user)

                    let result = await buy(
                        ctx.args[0],
                        user.pubKey,
                        user.secKey,
                        ctx.args[1]
                    )
                    console.log(result, toDecimals(result[1], tokenInfo[0], false), tokenInfo[0])

                    if(result[2]) {
                        await updateUserTrades(
                            ctx.message.from.id,
                            ctx.args[0],
                            "WTRX",
                            tokenInfo[1],
                            tokenInfo[4],
                            ctx.args[1],
                            toDecimals(result[1], tokenInfo[0], false),
                            ctx.args[2],
                            ctx.args[3],
                            timestamp
                        )
    
                        await ctx.replyWithHTML("<i>📈 Trade successfully excecuted.</i>")
                    }
                } else {
                    await ctx.replyWithHTML(`<i>Hello ${ctx.message.from.username} 👋, </i>\n\n<b>Wanna start an trading, Follow the instructions below:</b>\n\n<b>1. Make sure you pass only four(4) arguments to the '/buy' command.\n\n2. These arguments must come in the folowing order ie: 'Address of token to buy(ie: TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR)', 'Amount of token to buy(ie: 1000)', 'Take profit for the trade in percentage(%)' and 'Stop loss for the trade in percentage(%)'.</b>\n\n<i>Example: '/buy TNUC9Qb1rRpS5CbWLmNMxXBjyFoydXjWFR 1000 100 10'.</i>`)
                }
            } else {
                await ctx.reply("⚠️ You do not have a wallet for trading yet, Use the '/start' command to create your wallet, fund it with TRX and start trading.")
            }
        } else {
            await ctx.reply("⚠️ Bot is only used on private chats.")
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
    }
})

connectDB()

bot.launch()

setInterval(() => {
    monitorPrices()
}, 1000 * 60 * 5);