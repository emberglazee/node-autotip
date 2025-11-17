const packageJson = require('../../package.json')
const logger = require('./logger')
const tipper = require('./tipper')
const axios = require('axios')

const headers = {
    'User-Agent': `node-autotip@${packageJson.version}`
}

class Session {
    constructor(obj) {
        this.json = obj

        this.sessionKey = obj.sessionKey
        this.keepAliveRate = obj.keepAliveRate
        this.tipWaveRate = obj.tipWaveRate
        this.tipCycleRate = obj.tipCycleRate

        this.sendTipRequest()
        this.keepAlive = setInterval(() => this.sendKeepAlive(), this.keepAliveRate * 1000)
        this.tipWave = setInterval(() => this.sendTipRequest(), this.tipWaveRate * 1000)
    }

    async sendKeepAlive() {
        const key = this.sessionKey
        try {
            await axios.get(`https://autotip.sk1er.club/keepalive?key=${key}`, { headers })
            logger.debug(`Keeping alive session ${key}`)
        } catch (err) {
            logger.error(`Failed sending keepalive request! ${err}`)
        }
    }

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

    async logOut() {
        try {
            const res = await axios.get(`https://autotip.sk1er.club/logout?key=${this.sessionKey}`, { headers })
            logger.debug(`Autotip logout: ${res.data}`)
        } catch (err) {
            logger.error(`Failed sending logout request! ${err}`)
        }
    }
}

module.exports = Session
