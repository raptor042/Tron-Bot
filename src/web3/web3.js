import TronWeb from "tronweb";
import { config } from "dotenv";
import {
  PairERC20ABI,
  SunSwapV2Factory,
  SunSwapV2FactoryABI,
  SunSwapV2Router,
  SunSwapV2RouterABI,
  WTRX,
} from "./constants.js";
import { toDecimals } from "../utils.js";

config();

export const getConnection = (secKey) => {
  if (process.env.NODE_ENV == "DEV") {
    return new TronWeb({
      fullHost: process.env.TRON_MAINNET_URL,
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY },
      privateKey: secKey || process.env.PRIVATE_KEY,
    });
  } else {
    return new TronWeb({
      fullHost: process.env.TRON_MAINNET_URL,
      headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY },
      privateKey: secKey || process.env.PRIVATE_KEY,
    });
  }
};

export const getTimestamp = async () => {
  const web3 = getConnection();
  const block = await web3.trx.getCurrentBlock();

  return Number(block.block_header.raw_data.timestamp) / 1000;
};

export const getBandwidth = async () => {
  const web3 = getConnection();
  const bandwidth = await web3.trx.getBandwidth();
  const price = await web3.trx.getBandwidthPrices();

  return [bandwidth, price];
};

export const getTokenInfo = async (address) => {
  try {
    const web3 = getConnection();
    const factory = await web3.contract(SunSwapV2FactoryABI, SunSwapV2Factory);

    const pair = await factory.getPair(address, WTRX).call();
    console.log(web3.address.fromHex(pair));

    const token = await web3.contract(PairERC20ABI, address);
    const _pair = await web3.contract(PairERC20ABI, web3.address.fromHex(pair));

    const name = await token.name().call();
    console.log(name);

    const symbol = await token.symbol().call();
    console.log(symbol);

    const decimals = await token.decimals().call();
    console.log(Number(decimals));

    const token0 = await _pair.token0().call();
    console.log(token0);

    const token1 = await _pair.token1().call();
    console.log(token1);

    const reserves = await _pair.getReserves().call();
    console.log(reserves);

    let price;

    if (web3.address.toHex(WTRX) == token0) {
      price =
        Number(reserves[0]) /
        toDecimals(Number(reserves[1]), Number(decimals) - 6, false);
    } else {
      price =
        Number(reserves[1]) /
        toDecimals(Number(reserves[0]), Number(decimals) - 6, false);
    }

    return [
      Number(decimals),
      symbol,
      web3.address.fromHex(token0),
      web3.address.fromHex(token1),
      price,
      name,
    ];
  } catch (err) {
    console.log(err);

    throw err;
  }
};

export const getAmountsOut = async (address, amount) => {
  try {
    const web3 = getConnection();
    const router = await web3.contract(SunSwapV2RouterABI, SunSwapV2Router);

    const amountsOut = await router
      .getAmountsOut(amount, [WTRX, address])
      .call();
    console.log(amountsOut);

    return [Number(amountsOut[0][0]), Number(amountsOut[0][1])];
  } catch (err) {
    console.log(err);

    throw err;
  }
};

export const approve = async (address, pub, sec, amount) => {
  try {
    const web3 = getConnection(sec);
    const token = await web3.contract(PairERC20ABI, address);

    const allowance = await token.allowance(pub, SunSwapV2Router).call();
    console.log(Number(allowance), amount);

    const result = await token.approve(SunSwapV2Router, `${amount}`).send({
      feeLimit: 20_000_000,
      callValue: 0,
      shouldPollResponse: true,
    });
    console.log(result);

    return result;
  } catch (err) {
    console.log(err);

    throw err;
  }
};

export const buy = async (address, pub, sec, amount) => {
  try {
    const web3 = getConnection(sec);
    const router = await web3.contract(SunSwapV2RouterABI, SunSwapV2Router);

    const deadline = await getTimestamp();
    console.log(deadline);

    const result = await router
      .swapExactETHForTokens(0, [WTRX, address], pub, deadline + 2000)
      .send({
        feeLimit: 20_000_000,
        callValue: amount * 1_000_000,
        shouldPollResponse: true,
      });
    console.log(result);

    return [Number(result[0][0]), Number(result[0][1]), true];
  } catch (err) {
    console.log(err);

    throw err;
  }
};

export const sell = async (address, pub, sec, amount) => {
  try {
    const web3 = getConnection(sec);
    const router = await web3.contract(SunSwapV2RouterABI, SunSwapV2Router);

    const deadline = await getTimestamp();
    console.log(deadline, amount);

    const result = await router
      .swapExactTokensForETH(
        `${amount}`,
        0,
        [address, WTRX],
        pub,
        deadline + 2000
      )
      .send({
        feeLimit: 20_000_000,
        callValue: 0,
        shouldPollResponse: true,
      });
    console.log(result);

    return [Number(result[0][0]), Number(result[0][1]), true];
  } catch (err) {
    console.log(err);

    throw err;
  }
};

export const withdraw = async (pub, sec, to, amount) => {
  try {
    const web3 = getConnection(sec);
    const balance = await web3.trx.getBalance(pub);
    console.log({
      balance,
      to,
      pub,
      hex_to: web3.address.toHex(to),
      from: web3.address.toHex(pub),
    });

    if (amount < 0) {
      const result = await web3.transactionBuilder.sendTrx(
        web3.address.toHex(to),
        balance,
        web3.address.toHex(pub)
      );
      console.log(result);
    } else {
      const result = await web3.transactionBuilder.sendTrx(
        web3.address.toHex(to),
        amount * 1_000_000,
        web3.address.toHex(pub)
      );
      console.log(result);
    }

    return true;
  } catch (err) {
    console.log(err);

    throw err;
  }
};
