import { Telegraf, Markup, session } from "telegraf"
import { config } from "dotenv"
import { connectDB, createUser, getUser, getUserTradeByMsg, updateUserAutoBuySetting, updateUserAutoSellSetting, updateUserBuyWithSetting, updateUserReferrals, updateUserSellAtSetting, updateUserTrade, updateUserTrades, updateUserWallet } from "./src/db/db.js"
import { approve, buy, getAmountsOut, getConnection, getTimestamp, getTokenInfo, sell, withdraw } from "./src/web3/web3.js"
import { getTrade, isUser, monitorPrices, priceChangePercent, toDecimals } from "./src/utils.js"

config()

const URL = process.env.TELEGRAM_BOT_API

const bot = new Telegraf(URL, { handlerTimeout: 9_000_000 })

bot.use(session({ defaultSession: () => ({ token: '', amount: 0 }) }));
bot.use(Telegraf.log())

const buyToken = async (userId, address, amount, msg_id) => {
    try {
        const is_user = await isUser(userId)

        if(is_user) {
            const tokenInfo = await getTokenInfo(address)
            console.log(tokenInfo)

            const timestamp = await getTimestamp()
            console.log(timestamp)

            const amountsOut = await getAmountsOut(address, amount)
            console.log(amountsOut)

            let result = await buy(
                address,
                is_user[0].pubKey,
                is_user[0].secKey,
                amount
            )
            console.log(result, tokenInfo[0], toDecimals(result[1], tokenInfo[0], false))

            if(result[2]) {
                await updateUserTrades(
                    userId,
                    address,
                    "WTRX",
                    tokenInfo[1],
                    tokenInfo[4],
                    amount,
                    result[1],
                    timestamp,
                    msg_id
                )
            }

            return [true, tokenInfo, result[0], result[1], timestamp]
        }
    } catch (err) {
        console.log(err)

        throw err
    }
}

const sellToken = async (userId, address, amount) => {
    try {
        const is_user = await isUser(userId)

        if(is_user) {
            const tokenInfo = await getTokenInfo(address)
            console.log(tokenInfo)

            const timestamp = await getTimestamp()
            console.log(timestamp)

            const trade = await getTrade(userId, address)
            console.log(trade)

            const pnl = priceChangePercent(trade.price, tokenInfo[4])
            console.log(pnl)

            const approved = await approve(
                address,
                is_user[0].pubKey,
                is_user[0].secKey,
                (amount * trade.quote_amount) / 100
            )

            if(approved) {
                const result = await sell(
                    address,
                    is_user[0].pubKey,
                    is_user[0].secKey,
                    (amount * trade.quote_amount) / 100
                )
                console.log(result)
        
                if(result[2]) {
                    await updateUserTrade(
                        userId,
                        trade.bought_at,
                        timestamp,
                        pnl[0]
                    )
                }
            }

            return [true, tokenInfo, result[0], result[1], timestamp]
        }
    } catch (err) {
        console.log(err)

        throw err
    }
}

bot.command("start", async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const is_user = await isUser(ctx.message.from.id)
            console.log(is_user)
    
            if(!is_user[1]) {
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

                if(ctx.args > 0) {
                    await updateUserReferrals(ctx.args[0])
                }
    
                await ctx.replyWithHTML(
                    `<i>Hello ${ctx.message.from.username} 👋, </i>\n\n<i>Welcome to the <b>MEGATRON trading bot</b> where you can buy/sell at light speeds ⚡️ and secure massive profits 💰.</i>\n\n<i>A wallet has been created for you which will be used only for trading, make sure you fund the wallet with TRX and keep the private key safe.</i>\n\n<code>${account.address.base58}</code>\n\n<i>💰 Wanna buy a bag, just enter the token address.</i>`,
                    {
                        parse_mode : "HTML",
                        ...Markup.inlineKeyboard([
                            [
                                Markup.button.callback("🛒 Buy", "buy"),
                                Markup.button.callback("🗑 Sell & Manage", "sell"),                          
                            ],
                            [
                                Markup.button.callback("💳 Wallet", "wallet"),
                                Markup.button.callback("🛠 Settings", "settings"),  
                            ],
                            [
                                Markup.button.callback("🔄 Refresh", "refresh"),
                                Markup.button.callback("👨‍👧‍👦 Refer Friends", "refer"),
                            ]
                        ])
                    }
                )
            } else {
                await ctx.replyWithHTML(
                    `<i>Hello ${ctx.message.from.username} 👋, </i>\n\n<i>Welcome to the <b>MEGATRON trading bot</b> where you can buy/sell at light speeds ⚡️ and secure massive profits 💰.</i>\n\n<i>Make sure you fund the wallet with TRX and keep the private key safe.</i>\n\n<code>${is_user[0].pubKey}</code>\n\n<i>💰 Wanna buy a bag, just enter the token address.</i>`,
                    {
                        parse_mode : "HTML",
                        ...Markup.inlineKeyboard([
                            [
                                Markup.button.callback("🛒 Buy", "buy"),
                                Markup.button.callback("🗑 Sell & Manage", "sell"),                          
                            ],
                            [
                                Markup.button.callback("💳 Wallet", "wallet"),
                                Markup.button.callback("🛠 Settings", "settings"),  
                            ],
                            [
                                Markup.button.callback("🔄 Refresh", "refresh"),
                                Markup.button.callback("👨‍👧‍👦 Refer Friends", "referrals"),
                            ]
                        ])
                    }
                )
            }
        } else {
            await ctx.reply("⚠️ Bot is only used on private chats.")
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("refresh", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        const chat = await ctx.getChat()

        if(is_user[1] && "pinned_message" in chat) {
            const pinned_msg = chat.pinned_message.message_id
            console.log(pinned_msg)

            const trades = await getUserTradeByMsg(ctx.chat.id, pinned_msg)
            console.log(trades)

            const tokenInfo = await getTokenInfo(trades[0].token)
            console.log(tokenInfo)

            const pnl = priceChangePercent(trades[0].price, tokenInfo[4])
            console.log(pnl)

            if(bought[0]) {
                await ctx.editMessageText(
                    `<i>📈 Trade successfully excecuted.</i>\n\n<i>Token : <code>${trades[0].token}</code></i>\n\n<i>Price: ${Number(tokenInfo[4]).toFixed(6)} TRX</i>\n\n<i>Amount : ${trades[0].base_amount.toFixed(2)} TRX</i>\n\n<i>Bought : ${toDecimals(trades[0].quote_amount, tokenInfo[0], false).toFixed(2)} ${trades[0].quote}</i>\n\n<i>pNl : 0</i>\n\n<i>Time : ${new Date(trades[0].bought_at * 1000)}</i>`,
                    {
                        parse_mode: "HTML",
                        message_id: pinned_msg
                    }
                )
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("referrals", async ctx => {
    const is_user = await isUser(ctx.chat.id)
        
    if(is_user[1]) {
        await ctx.reply(
            `<b>👨‍👧‍👦 REFERRALS:</b>\n\n<i>Your Referral Link : https://t.me/MegaTronTradingBot?start=${ctx.chat.id}</i>\n\n<i>👥 Referrals: ${is_user[0].referrals}</i>\n<i>💰 Referral Fees: ${is_user[0].referrals * 5} TRX</i>\n\n<i>Refer your friends and earn <b>5 TRX</b> of their fees as long as you trade with <b>MEGATRON</b>!</i>`,
            {
                parse_mode : "HTML",
                ...Markup.inlineKeyboard([
                    Markup.button.callback("Close", "cancel"),
                ])
            }
        )
    } else {
        await ctx.reply("⚠️ You do not have a wallet for trading yet, Use the '/start' command to create your wallet, fund it with TRX and start trading.")
    }
})

bot.action("wallet", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            const web3 = getConnection()
            const balance = await web3.trx.getBalance(is_user[0].pubKey)
            console.log(Number(balance), Number(balance) / 1_000_000)

            await ctx.replyWithHTML(
                `<i>💳 Your Wallet:</i>\n\n<i>🔑 Address: <code>${is_user[0].pubKey}</code></i>\n\n<i>💰 Balance: ${Number(balance) / 1_000_000} TRX</i>\n\n<i>Tap to copy the address and send TRX to deposit.</i>`,
                {
                    parse_mode : "HTML",
                    ...Markup.inlineKeyboard([
                        [
                            Markup.button.callback("📤 Withdraw all TRX", "withdraw_all"),
                            Markup.button.callback("📤 Withdraw X TRX", "withdraw_x"),
                        ],
                        [
                            Markup.button.callback("🔃 Reset Wallet", "reset"),
                            Markup.button.callback("🔐 Export Private Key", "export"),
                        ],
                    ])
                    
                }
            )
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("withdraw_all", async ctx => {
    try {
        await ctx.replyWithHTML("<i>🔁 Reply with the destination address.</i>")
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("withdraw_x", async ctx => {
    try {
        await ctx.replyWithHTML("<i>🔁 Reply with the amount of TRX you want to withdraw.</i>")
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("reset", async ctx => {
    try {
        await ctx.replyWithHTML(
            "<i>❓ Are you sure you want to reset your <b>Wallet</b>?</i>\n\n<b>🚨 Warning:</b> <i>This action is irreversible.</i>\n\n<i>A new wallet will be created and the old one will be discarded.</i>",
            {
                parse_mode : "HTML",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("❌ Cancel", "cancel")],
                    [Markup.button.callback("✅ Confirm", "confirm_reset")],
                ]),
                
            }
        )
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("confirm_reset", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            await ctx.replyWithHTML(`<i>🔐 Old Wallet Private Key:</i>\n\n<i>${is_user[0].secKey}</i>\n\n<i>You can now import the key into a wallet. Save this key in case you need to access the wallet again.</i>`)

            const web3 = getConnection()
            const account = await web3.createAccount()
            console.log(account)

            if(account) {
                await ctx.replyWithHTML(`<i>🔑 Your new wallet address is:</i>\n\n<i>${account.address.base58}</i>\n\n<i>You can now send TRX to this address to begin trading.</i>`)

                await updateUserWallet(
                    ctx.chat.id,
                    account.address.base58,
                    account.privateKey
                )
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("export", async ctx => {
    try {
        await ctx.replyWithHTML(
            "<i>❓🔐 Are you sure you want to export your <b>Private Key</b>?</i>",
            {
                parse_mode : "HTML",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("❌ Cancel", "cancel")],
                    [Markup.button.callback("✅ Confirm", "confirm_export")],
                ]),
                
            }
        )
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("confirm_export", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            await ctx.replyWithHTML(`<i>🔐 Private Key:</i>\n\n<code>${is_user[0].secKey}</code>\n\n<i>You can now import the key into a wallet. Delete this message once you are done.</i>`)
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("settings", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            await ctx.replyWithHTML(
                `<i>🛠 Settings:</i>\n\n<b>AUTO BUY${is_user[0].settings.auto_buy ? "(🟢 Enabled currently)" : "(🔴 Disabled currently)"}</b>\n<i>Buy immediately when token address is pasted. Tap buttons to toggle.</i>\n\n<b>AUTO SELL${is_user[0].settings.auto_sell ? "(🟢 Enabled currently)" : "(🔴 Disabled currently)"}</b>\n<i>Sell immediately when token price increases by 10% or 50% or 100%. Tap buttons to toggle.</i>`,
                {
                    parse_mode : "HTML",
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback("TOGGLE AUTO BUY", "toggle_buy")],
                        [
                            Markup.button.callback("💰 Buy with 50 TRX", "set_buy_50"),
                            Markup.button.callback("💰 Buy with 100 TRX", "set_buy_100"),
                        ],
                        [Markup.button.callback("💰 Buy with X TRX", "set_buy_x")],
                        [Markup.button.callback("TOGGLE AUTO SELL", "toggle_sell")],
                        [
                            Markup.button.callback("📈 Sell at 50%", "set_sell_50"),
                            Markup.button.callback("📈 Sell at 100%", "set_sell_100"),
                        ],
                        [Markup.button.callback("📈 Sell at X%", "set_sell_x")],
                    ])
                }
            )
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("toggle_buy", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            if(is_user[0].settings.auto_buy) {
                await updateUserAutoBuySetting(ctx.chat.id, false)

                await ctx.reply("🔴 Auto Buy is now disabled.")
            } else {
                await updateUserAutoBuySetting(ctx.chat.id, true)

                await ctx.reply("🟢 Auto Buy is now enabled. Make sure you set the amount to buy with, by clicking the above buttons 🖕.")
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("set_buy_50", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            if(is_user[0].settings.auto_buy) {
                await updateUserBuyWithSetting(ctx.chat.id, 50)

                await ctx.reply("🟢 Auto Buy is set to buy with 50 TRX.")
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("set_buy_100", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            if(is_user[0].settings.auto_buy) {
                await updateUserBuyWithSetting(ctx.chat.id, 100)

                await ctx.reply("🟢 Auto Buy is set to buy with 100 TRX.")
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("set_buy_x", async ctx => {
    try {
        await ctx.replyWithHTML("<i>🔁 Reply with the amount of TRX you want to auto buy with.</i>")
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("toggle_sell", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            if(is_user[0].settings.auto_sell) {
                await updateUserAutoSellSetting(ctx.chat.id, false)

                await ctx.reply("🔴 Auto Sell is now disabled.")
            } else {
                await updateUserAutoSellSetting(ctx.chat.id, true)

                await ctx.reply("🟢 Auto Sell is now enabled. Make sure you set the percent to sell at, by clicking the above buttons 🖕.")
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("set_sell_50", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            if(is_user[0].settings.auto_sell) {
                await updateUserSellAtSetting(ctx.chat.id, 50)

                await ctx.reply("🟢 Auto Sell is now set at 50% increase in price.")
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("set_sell_100", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            if(is_user[0].settings.auto_sell) {
                await updateUserSellAtSetting(ctx.chat.id, 100)

                await ctx.reply("🟢 Auto Sell is now set at 100% increase in price.")
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("set_sell_x", async ctx => {
    try {
        await ctx.replyWithHTML("<i>🔁 Reply with the percent of price increase you want to auto sell at.</i>")
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.command("buy", async ctx => {
    try {
        await ctx.replyWithHTML(
            "<i>🛒🆔 Buy Token:</i>\n\n<b>To buy a token enter a token address.</b>",
            {
                parse_mode : "HTML",
                ...Markup.inlineKeyboard([
                    Markup.button.callback("Close", "cancel"),
                ])
            }
        )
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("buy", async ctx => {
    try {
        await ctx.replyWithHTML(
            "<i>🛒🆔 Buy Token:</i>\n\n<b>To buy a token enter a token address.</b>",
            {
                parse_mode : "HTML",
                ...Markup.inlineKeyboard([
                    Markup.button.callback("Close", "cancel"),
                ])
            }
        )
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("buy_50", async ctx => {
    try {
        const msg = await ctx.reply("📈 Buying.....")
        console.log(msg)

        const bought = await buyToken(ctx.chat.id, ctx.session.token, 50, msg.message_id)

        if(bought[0]) {
            await ctx.editMessageText(
                `<i>📈 Trade successfully excecuted.</i>\n\n<i>Token : <code>${ctx.session.token}</code></i>\n\n<i>Price: ${Number(bought[1][4]).toFixed(6)} TRX</i>\n\n<i>Amount : ${(Number(bought[2]) / 1_000_000).toFixed(2)} TRX</i>\n\n<i>Bought : ${toDecimals(bought[3], bought[1][0], false).toFixed(2)} ${bought[1][1]}</i>\n\n<i>pNl : 0</i>\n\n<i>Time : ${new Date(bought[4] * 1000)}</i>`,
                {
                    parse_mode: "HTML",
                    message_id: msg.message_id
                }
            )

            setTimeout(async () => {
                await ctx.pinChatMessage(msg.message_id)
            }, 1000);
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("buy_100", async ctx => {
    try {
        const msg = await ctx.reply("📈 Buying.....")
        console.log(msg)

        const bought = await buyToken(ctx.chat.id, ctx.session.token, 100, msg.message_id)

        if(bought[0]) {
            await ctx.editMessageText(
                `<i>📈 Trade successfully excecuted.</i>\n\n<i>Token : <code>${ctx.session.token}</code></i>\n\n<i>Price: ${Number(bought[1][4]).toFixed(6)} TRX</i>\n\n<i>Amount : ${(Number(bought[2]) / 1_000_000).toFixed(2)} TRX</i>\n\n<i>Bought : ${toDecimals(bought[3], bought[1][0], false).toFixed(2)} ${bought[1][1]}</i>\n\n<i>pNl : 0</i>\n\n<i>Time : ${new Date(bought[4] * 1000)}</i>`,
                {
                    parse_mode: "HTML",
                    message_id: msg.message_id
                }
            )

            setTimeout(async () => {
                await ctx.pinChatMessage(msg.message_id)
            }, 1000);
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("buy_x", async ctx => {
    try {
        await ctx.replyWithHTML("<i>🔁 Reply with the amount of TRX you want to buy with.</i>")
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.command("sell", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            const trades = is_user[0].trades.filter((trade) => trade.sold == false)
            console.log(trades)

            if(trades.length > 0) {
                let text = "<i>📈 Open Positions:</i>\n\n"

                trades.forEach(async (trade, i) => {
                    const tokenInfo = await getTokenInfo(trade.token)
                    console.log(tokenInfo)

                    text += `<b>${i + 1}.)</b><i>Token : <code>${trade.token}</code></i>\n\n<i>Price: ${Number(trade.price).toFixed(6)} TRX</i>\n\n<i>Amount : ${Number(trade.base_amount).toFixed(2)} ${trade.base}</i>\n\n<i>Bought : ${toDecimals(trade.quote_amount, tokenInfo[0], false).toFixed(2)} ${trade.quote}</i>\n\n<i>Time : ${new Date(Number(trade.bought_at) * 1000)}</i>\n\n`
                })

                setTimeout(async () => {
                    await ctx.replyWithHTML(
                        text,
                        {
                            parse_mode : "HTML",
                            ...Markup.inlineKeyboard([
                                [Markup.button.callback("❌ Cancel", "cancel")],
                                [
                                    Markup.button.callback("💰 Sell 50%", "sell_50"),
                                    Markup.button.callback("💰 Sell 100%", "sell_100"),
                                ],
                                [Markup.button.callback("💰 Sell X%", "sell_x")],
                            ]),
                            
                        }
                    )
                }, 1000 * 3);
            } else {
                await ctx.replyWithHTML(
                    "<i>📈 No open positions.</i>",
                    {
                        parse_mode : "HTML",
                        ...Markup.inlineKeyboard([
                            Markup.button.callback("Close", "cancel"),
                        ])
                    }
                )
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("sell", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)
        console.log(is_user)

        if(is_user[1]) {
            const trades = is_user[0].trades.filter((trade) => trade.sold == false)
            console.log(trades)

            if(trades.length > 0) {
                let text = "<i>📈 Open Positions:</i>\n\n"

                trades.forEach(async (trade, i) => {
                    const tokenInfo = await getTokenInfo(trade.token)
                    console.log(tokenInfo)

                    text += `<b>${i + 1}.)</b><i>Token : <code>${trade.token}</code></i>\n\n<i>Price: ${Number(trade.price).toFixed(6)} TRX</i>\n\n<i>Amount : ${Number(trade.base_amount).toFixed(2)} ${trade.base}</i>\n\n<i>Bought : ${toDecimals(trade.quote_amount, tokenInfo[0], false).toFixed(2)} ${trade.quote}</i>\n\n<i>Time : ${new Date(Number(trade.bought_at) * 1000)}</i>\n\n`
                })

                setTimeout(async () => {
                    await ctx.replyWithHTML(
                        text,
                        {
                            parse_mode : "HTML",
                            ...Markup.inlineKeyboard([
                                [Markup.button.callback("❌ Cancel", "cancel")],
                                [
                                    Markup.button.callback("💰 Sell 50%", "sell_50"),
                                    Markup.button.callback("💰 Sell 100%", "sell_100"),
                                ],
                                [Markup.button.callback("💰 Sell X%", "sell_x")],
                            ]),
                            
                        }
                    )
                }, 1000 * 3);
            } else {
                await ctx.replyWithHTML(
                    "<i>📈 No open positions.</i>",
                    {
                        parse_mode : "HTML",
                        ...Markup.inlineKeyboard([
                            Markup.button.callback("Close", "cancel"),
                        ])
                    }
                )
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("sell_100", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)

        if(is_user && !is_user[0].settings.auto_sell) {
            console.log(ctx.session)
            ctx.session.amount = 100

            await ctx.replyWithHTML("<i>🔁 Reply with the token address you want to sell.</i>")
        } else {
            await ctx.reply("Auto Sell is Enabled. You must disable it to continue.")
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("sell_50", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)

        if(is_user && !is_user[0].settings.auto_sell) {
            console.log(ctx.session)
            ctx.session.amount = 50

            await ctx.replyWithHTML("<i>🔁 Reply with the token address you want to sell.</i>")
        } else {
            await ctx.reply("Auto Sell is Enabled. You must disable it to continue.")
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.action("sell_x", async ctx => {
    try {
        const is_user = await isUser(ctx.chat.id)

        if(is_user && !is_user[0].settings.auto_sell) {
            await ctx.replyWithHTML("<i>🔁 Reply with the percentage of the tokens you want to sell.</i>")
        } else {
            await ctx.reply("Auto Sell is Enabled. You must disable it to continue.")
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.hears(/T/, async ctx => {
    try {
        if (ctx.message.chat.type == "private") {
            const is_user = await isUser(ctx.message.from.id)
            const web3 = getConnection()
            const isAddress = web3.isAddress(ctx.message.text)
            console.log(isAddress)

            if(isAddress) {
                if(is_user) {
                    if("reply_to_message" in ctx.message && ctx.message.reply_to_message.text == "🔁 Reply with the destination address.") {
                        const result = await withdraw(
                            is_user[0].pubKey,
                            is_user[0].secKey,
                            ctx.message.text,
                            -1
                        )
            
                        if(result) {
                            await ctx.reply(`🟢 Withdrawal successful.`)
                        }
                    } else if("reply_to_message" in ctx.message && isFinite(ctx.message.reply_to_message.text)) {
                        const result = await withdraw(
                            is_user[0].pubKey,
                            is_user[0].secKey,
                            ctx.message.text,
                            Number(ctx.message.reply_to_message.text),
                        )
            
                        if(result) {
                            await ctx.reply(`🟢 Withdrawal successful.`)
                        }
                    } else if("reply_to_message" in ctx.message && ctx.message.reply_to_message.text == "🔁 Reply with the token address you want to sell.") {
                        const msg = await ctx.reply("📈 Selling.....")
                        console.log(msg)

                        const sold = await sellToken(ctx.chat.id, ctx.message.text, ctx.session.amount)

                        if(sold[0]) {
                            await ctx.editMessageText(
                                `<i>📈 Sold successfully excecuted.</i>\n\n<i>Token : ${ctx.message.text}</i>\n\n<i>Price: ${Number(sold[1][4]).toFixed(6)} TRX</i>\n\n<i>Amount : ${(Number(sold[2]) / 1_000_000).toFixed(2)} TRX</i>\n\n<i>Sold : ${toDecimals(sold[3], sold[1][0], false).toFixed(2)} ${sold[1][1]}</i>\n\n<i>Time : ${new Date(sold[4] * 1000)}</i>`,
                                {
                                    parse_mode: "HTML",
                                    message_id: msg.message_id
                                }
                            )
                        }
                    } else {
                        console.log(ctx.session)
                        ctx.session.token = ctx.message.text
        
                        const tokenInfo = await getTokenInfo(ctx.message.text)
                        console.log(tokenInfo)
            
                        const balance = await web3.trx.getBalance(is_user[0].pubKey)
                        console.log(Number(balance), Number(balance) / 1_000_000)
        
                        if(is_user[0].settings.auto_buy) {
                            const msg = await ctx.reply("📈 Buying.....")
                            console.log(msg)
        
                            const bought = await buyToken(ctx.chat.id, ctx.message.text, Number(is_user[0].settings.buy_with), msg.message_id)
    
                            if(bought[0]) {
                                await ctx.editMessageText(
                                    `<i>📈 Trade successfully excecuted.</i>\n\n<i>Token : <code>${ctx.message.text}</code></i>\n\n<i>Price: ${Number(bought[1][4]).toFixed(6)} TRX</i>\n\n<i>Amount : ${(Number(bought[2]) / 1_000_000).toFixed(2)} TRX</i>\n\n<i>Bought : ${toDecimals(bought[3], bought[1][0], false).toFixed(2)} ${bought[1][1]}</i>\n\n<i>pNl : 0</i>\n\n<i>Time : ${new Date(bought[4] * 1000)}</i>`,
                                    {
                                        parse_mode: "HTML",
                                        message_id: msg.message_id
                                    }
                                )

                                setTimeout(async () => {
                                    await ctx.pinChatMessage(msg.message_id)
                                }, 1000);
                            }
                        } else {
                            await ctx.replyWithHTML(
                                `<b>💎 ${tokenInfo[5]} | ${tokenInfo[1]} 💎</b>\n\n<b>📌 CA:</b><i>${ctx.message.text}</i>\n\n<b>💵 Price:</b><i>${Number(tokenInfo[4]).toFixed(6)} TRX</i>\n\n<b>💳 Wallet Balance:</b><i>${(Number(balance) / 1_000_000).toFixed(2)} TRX</i>\n\n<b>💰 Wanna buy a bag, 👇 click ant button below:</b>`,
                                {
                                    parse_mode : "HTML",
                                    ...Markup.inlineKeyboard([
                                        [Markup.button.callback("❌ Cancel", "cancel")],
                                        [
                                            Markup.button.callback("💰 Buy with 50 TRX", "buy_50"),
                                            Markup.button.callback("💰 Buy with 100 TRX", "buy_100"),
                                        ],
                                        [Markup.button.callback("💰 Buy with X TRX", "buy_x")],
                                    ]),
                                    
                                }
                            )
                        }
                    }
                } else {
                    await ctx.reply("⚠️ You do not have a wallet for trading yet, Use the '/start' command to create your wallet, fund it with TRX and start trading.")
                }
            } else {
                await ctx.reply("⚠️ The token address is invalid.")
            }
        } else {
            await ctx.reply("⚠️ Bot is only used on private chats.")
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

bot.on("message", async ctx => {
    try {
        if("reply_to_message" in ctx.message) {
            const text = ctx.message.reply_to_message.text

            if(text == "🔁 Reply with the percentage of the tokens you want to sell.") {
                console.log(ctx.message.text, ctx.session)
                ctx.session.amount = ctx.message.text

                await ctx.sendMessage(`🔁 Reply with the token address you want to sell.`)
            }
    
            if(text == "🔁 Reply with the amount of TRX you want to withdraw.") {
                console.log(ctx.message.text)
                await ctx.sendMessage(`🖕 Reply to the above text with the destination address.`)
            }
    
            if(text == "🔁 Reply with the amount of TRX you want to buy with.") {
                console.log(ctx.chat.id, ctx.message.text, ctx.session.token)
                
                const msg = await ctx.reply("📈 Buying.....")
                console.log(msg)
                
                const bought = await buyToken(ctx.chat.id, ctx.session.token, Number(ctx.message.text), msg.message_id)
    
                if(bought[0]) {
                    await ctx.editMessageText(
                        `<i>📈 Trade successfully excecuted.</i>\n\n<i>Token : <code>${ctx.session.token}</code></i>\n\n<i>Price: ${Number(bought[1][4]).toFixed(6)} TRX</i>\n\n<i>Amount : ${(Number(bought[2]) / 1_000_000).toFixed(2)} TRX</i>\n\n<i>Bought : ${toDecimals(bought[3], bought[1][0], false).toFixed(2)} ${bought[1][1]}</i>\n\n<i>pNl : 0</i>\n\n<i>Time : ${new Date(bought[4] * 1000)}</i>`,
                        {
                            parse_mode: "HTML",
                            message_id: msg.message_id
                        }
                    )

                    setTimeout(async () => {
                        await ctx.pinChatMessage(msg.message_id)
                    }, 1000);
                }
            }
            
            if(text == "🔁 Reply with the amount of TRX you want to auto buy with.") {
                console.log(ctx.message.text)
                const is_user = await isUser(ctx.chat.id)
                console.log(is_user)
        
                if(is_user[1]) {
                    if(is_user[0].settings.auto_buy) {
                        await updateUserBuyWithSetting(ctx.chat.id, Number(ctx.message.text))
        
                        await ctx.reply(`🟢 Auto Buy is set to buy with ${ctx.message.text} TRX.`)
                    }
                }
            } 
            
            if(text == "🔁 Reply with the percent of price increase you want to auto sell at.") {
                console.log(ctx.message.text)
                const is_user = await isUser(ctx.chat.id)
                console.log(is_user)
        
                if(is_user[1]) {
                    if(is_user[0].settings.auto_sell) {
                        await updateUserSellAtSetting(ctx.chat.id, Number(ctx.message.text))
        
                        await ctx.reply(`🟢 Auto Sell is now set at ${ctx.message.text}% increase in price.`)
                    }
                }
            } 
            
            if(text == "🖕 Reply to the above text with the destination address.") {
                console.log(ctx.message.text, ctx.message.reply_to_message.text)
                const is_user = await isUser(ctx.chat.id)
                console.log(is_user)
        
                if(is_user[1]) {
                    const result = await withdraw(
                        is_user[0].pubKey,
                        is_user[0].secKey,
                        ctx.message.text,
                        Number(ctx.message.reply_to_message.text)
                    )
        
                    if(result) {
                        await ctx.reply(`🟢 Withdrawal successful.`)
                    }
                }
            }
        }
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)

        console.log(err)
    }
})

bot.action("cancel", async ctx => {
    try {
        console.log("cancel", ctx.callbackQuery.message.message_id)
        await ctx.deleteMessage(ctx.callbackQuery.message.message_id)
    } catch (err) {
        await ctx.replyWithHTML(`<b>🚫 An error just ocurred. Sorry for the Inconveniences.</b>`)
        console.log(err)
    }
})

connectDB()

bot.launch()

setInterval(() => {
    monitorPrices()
}, 1000 * 60 * 15);