import { getUser, getUsers, updateUserTrade } from "./db/db.js"
import { approve, getBandwidth, getTimestamp, getTokenInfo, sell } from "./web3/web3.js"

export const isUser = async (userId) => {
    const user = await getUser(userId)
    console.log(user)

    return user ? true : false
}

export const toDecimals = (value, decimals, overflow) => {
    let result
    if(overflow) {
        result = value * (10 ** decimals)
        console.log(result)
    } else {
        result = value / (10 ** decimals)
        console.log(result)
    }

    return result
}

export const priceChangePercent = (price0, price1) => {
    const price_change = price1 - price0
    console.log(price_change)

    let result = []

    if(price_change > 0) {
        console.log("In profit")
        result[0] = (price_change / price0) * 100
        result[1] = true
        console.log(result)
    } else {
        console.log("In loss")
        result[0] = (price_change / price0) * 100
        result[1] = false
        console.log(result)
    }

    return result
}

export const monitorPrices = async () => {
    try {
        const users = await getUsers()

        users.forEach(user => {
            const trades = user.trades
            console.log(trades)

            trades.forEach(async trade => {
                if(!trade.sold) {
                    const tokenInfo = await getTokenInfo(trade.token)
                    console.log(tokenInfo)

                    const timestamp = await getTimestamp()
                    console.log(timestamp)

                    const pnl = priceChangePercent(trade.price, tokenInfo[4])
                    console.log(pnl)

                    const bandwidth = await getBandwidth()
                    console.log(bandwidth)

                    const approved = await approve(
                        trade.token,
                        user.pubKey,
                        user.secKey,
                        toDecimals(trade.quote_amount, tokenInfo[0], true)
                    )

                    if(pnl[1] && pnl[0] >= trade.take_profit && approved) {
                        const result = await sell(
                            trade.token,
                            user.pubKey,
                            user.secKey,
                            toDecimals(trade.quote_amount, tokenInfo[0], true)
                        )
                        console.log(result)
    
                        if(result[2]) {
                            await updateUserTrade(
                                user.userId,
                                trade.bought_at,
                                timestamp,
                                pnl[0]
                            )
                        }
                    }
                    
                    if(!pnl[1] && Math.abs(pnl[0]) >= trade.stop_loss && approved) {
                        const result = await sell(
                            trade.token,
                            user.pubKey,
                            user.secKey,
                            toDecimals(trade.quote_amount, tokenInfo[0], true)
                        )
                        console.log(result)
    
                        if(result[2]) {
                            await updateUserTrade(
                                user.userId,
                                trade.bought_at,
                                timestamp,
                                pnl[0]
                            )
                        }
                    }
                }
            })
        })
    } catch (err) {
        console.log(err)
    }
}