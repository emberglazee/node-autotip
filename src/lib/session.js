import { packageVersion } from '../util/utility.js'
import logger from './logger.js'
import tipper from './tipper.js'
import axios from 'axios'

const headers = {
    'User-Agent': `@emberglazee/node-autotip@${packageVersion}`
}

/**
 * @class Session
 * @description Manages the connection to the autotip server, by sending keep-alive
 * requests and fetching players to tip.
 */
class Session {
    /**
     * @param {object} obj The session object from the autotip server
     */
    constructor(obj) {
        this.json = obj

        this.sessionKey = obj.sessionKey
        this.keepAliveRate = obj.keepAliveRate
        this.tipWaveRate = obj.tipWaveRate
        this.tipCycleRate = obj.tipCycleRate

        this.keepAlive = setInterval(() => this.sendKeepAlive(), this.keepAliveRate * 1000)
        this.tipWave = setInterval(() => this.sendTipRequest(), this.tipWaveRate * 1000)
    }

    /**
     * @description Sends a keep-alive request to the autotip server to prevent the
     * session from expiring.
     */
    async sendKeepAlive() {
        const key = this.sessionKey
        try {
            await axios.get(`https://autotip.sk1er.club/keepalive?key=${key}`, { headers })
            logger.debug(`Keeping alive session ${key}`)
        } catch (err) {
            logger.error(`Failed sending keepalive request! ${err}`)
        }
    }

    /**
     * @description Gets a list of players to tip from the autotip server.
     * @param {string[]} [games=[]] An array of games to tip in. If empty, players
     * from any game will be returned.
     */
    async sendTipRequest(games = []) {
        const key = this.sessionKey
        try {
            const res = await axios.get(`https://autotip.sk1er.club/tip?key=${key}`, { headers })
            const JSONbody = res.data

            if (JSONbody.success) {
                const queue = (games.length > 0
                    ? JSONbody.tips.filter(tip => games.includes(tip.gamemode))
                    : JSONbody.tips)
                logger.debug(`Need to tip ${JSON.stringify(queue)}`)
                tipper.updateQueue(queue)
            }
        } catch (e) {
            logger.warn(`Tipper sent invalid json body! ${e}`)
        }
    }

    /**
     * @description Logs out of the autotip session to gracefully close the connection.
     */
    async logOut() {
        clearInterval(this.keepAlive)
        clearInterval(this.tipWave)
        try {
            const res = await axios.get(`https://autotip.sk1er.club/logout?key=${this.sessionKey}`, { headers })
            logger.debug(`Autotip logout: ${res.data}`)
        } catch (err) {
            logger.error(`Failed sending logout request! ${err}`)
        }
    }
}

export default Session
