import { getUser, getUsers, updateUserTrade } from "./db/db.js";
import {
  approve,
  getBandwidth,
  getTimestamp,
  getTokenInfo,
  sell,
} from "./web3/web3.js";

export const isUser = async (userId) => {
  const user = await getUser(userId);
  console.log(user);

  return user ? [user, true] : [user, false];
};

export const getTrade = async (userId, token) => {
  const user = await getUser(userId);
  console.log(user);

  let _trade;

  user.trades.forEach((trade) => {
    if (trade.token == token && !trade.sold) {
      _trade = trade;
    }
  });

  return _trade;
};

export const toDecimals = (value, decimals, overflow) => {
  let result;
  if (overflow) {
    result = value * 10 ** decimals;
    console.log(result.toString(10));
  } else {
    result = value / 10 ** decimals;
    console.log(result);
  }

  return result;
};

export const priceChangePercent = (price0, price1) => {
  const price_change = price1 - price0;
  console.log(price_change);

  let result = [];

  if (price_change > 0) {
    console.log("In profit");
    result[0] = (price_change / price0) * 100;
    result[1] = true;
    console.log(result);
  } else {
    console.log("In loss");
    result[0] = (price_change / price0) * 100;
    result[1] = false;
    console.log(result);
  }

  return result;
};

export const monitorPrices = async () => {
  try {
    const users = await getUsers();

    users.forEach((user) => {
      const trades = user.trades;

      trades.forEach(async (trade) => {
        console.log(trade, user.settings.auto_sell);
        if (!trade.sold && user.settings.auto_sell) {
          const tokenInfo = await getTokenInfo(trade.token);
          console.log(tokenInfo);

          const timestamp = await getTimestamp();
          console.log(timestamp);

          const pnl = priceChangePercent(trade.price, tokenInfo[4]);
          console.log(pnl);

          if (pnl[1] && pnl[0] >= user.settings.sell_at) {
            const approved = await approve(
              trade.token,
              user.pubKey,
              user.secKey,
              trade.quote_amount
            );

            if (approved) {
              const result = await sell(
                trade.token,
                user.pubKey,
                user.secKey,
                trade.quote_amount
              );
              console.log(result);

              if (result[2]) {
                await updateUserTrade(
                  user.userId,
                  trade.bought_at,
                  timestamp,
                  pnl[0]
                );
              }
            }
          }
        }
      });
    });
  } catch (err) {
    console.log(err);
  }
};
