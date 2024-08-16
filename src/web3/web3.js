import TronWeb from "tronweb"
import { config } from "dotenv"
import { PairERC20ABI, SunSwapV2Factory, SunSwapV2FactoryABI, SunSwapV2Router, SunSwapV2RouterABI, WTRX } from "./constants.js"

config()

export const getTimestamp = async () => {
    const web3 = getConnection()
    const block = await web3.trx.getCurrentBlock()

    return Number(block.block_header.raw_data.timestamp) / 1000
}

export const getTokenInfo = async (address) => {
    try {
        const web3 = getConnection()
        const factory = await web3.contract(SunSwapV2FactoryABI, SunSwapV2Factory)

        const pair = await factory.getPair(address, WTRX).call()
        console.log(pair, web3.address.fromHex(pair))

        const token = await web3.contract(PairERC20ABI, address)
        const _pair = await web3.contract(PairERC20ABI, web3.address.fromHex(pair))
        
        const symbol = await token.symbol().call()
        console.log(symbol)
        const token0 = await _pair.token0().call()
        console.log(token0)
        const token1 = await _pair.token1().call()
        console.log(token1)
        const reserves = await _pair.getReserves().call()
        console.log(reserves)

        let price
        if(web3.address.toHex(WTRX) == token0) {
            price = Number(reserves[0]) / Number(reserves[1])
        } else {
            price = Number(reserves[1]) / Number(reserves[0])
        }

        return [symbol, web3.address.fromHex(token0), web3.address.fromHex(token1), price]
    } catch (err) {
        console.log(err)

        throw err
    }
}

export const getAmountsOut = async (address, amount) => {
    try {
        const web3 = getConnection()
        const router = await web3.contract(SunSwapV2RouterABI, SunSwapV2Router)

        const amountsOut = await router.getAmountsOut(amount, [WTRX, address]).call()
        console.log(amountsOut)

        return [Number(amountsOut[0][0]), Number(amountsOut[0][1])]
    } catch (err) {
        console.log(err)

        throw err
    }
}

export const buy = async (address, user, amount) => {
    try {
        const web3 = getConnection()
        const router = await web3.contract(SunSwapV2RouterABI, SunSwapV2Router)

        const deadline = await getTimestamp()
        console.log(deadline)

        const result = await router.swapExactETHForTokens(
            0,
            [WTRX, address],
            user,
            deadline + 1000
        ).send({
            feeLimit: 100_000_000,
            callValue: amount * (1_000_000),
            shouldPollResponse: true
        })
        console.log(result)

        return [Number(result[0][0]), Number(result[0][1]), true]
    } catch (err) {
        console.log(err)

        throw err
    }
}

export const getConnection = () => {
    if(process.env.NODE_ENV == "DEV") {
        return new TronWeb({
            fullHost: process.env.TRON_MAINNET_URL,
            headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY },
            privateKey: process.env.PRIVATE_KEY
        })
    } else {
        return new TronWeb({
            fullHost: process.env.TRON_MAINNET_URL,
            headers: { "TRON-PRO-API-KEY": process.env.TRON_API_KEY },
            privateKey: process.env.PRIVATE_KEY
        })
    }
}