import { getUser, getUsers, updateUserTrade } from "./db/db.js"
import { getTokenInfo, sell } from "./web3/web3.js"

export const isUser = async (userId) => {
    const user = await getUser(userId)
    console.log(user)

    return user ? true : false
}

export const toDecimals = (value, decimals) => {
    const result = value / (10 ** decimals)
    console.log(result)

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
        result[0] = (Math.abs(price_change) / price0) * 100
        result[1] = false
        console.log(result)
    }

    return result
}

export const monitorPrices = async () => {
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

                if(pnl[1] && pnl[0] >= trade.take_profit) {
                    const result = await sell(
                        trade.token,
                        user.pubKey,
                        trade.quote_amount
                    )

                    if(result) {
                        await updateUserTrade(
                            user.userId,
                            trade.bought_at,
                            timestamp
                        )
                    }
                }
                
                if(!pnl[1] && pnl[0] >= trade.stop_loss) {
                    const result = await sell(
                        trade.token,
                        user.pubKey,
                        trade.quote_amount
                    )

                    if(result) {
                        await updateUserTrade(
                            user.userId,
                            trade.bought_at,
                            timestamp
                        )
                    }
                }
            }
        })
    })
}