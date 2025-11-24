/**
 * @fileoverview This file manages the process of tipping players. It maintains a
 * queue of players to tip, and sends the tip commands to the server at a
 * regular interval. It also handles failed tips by adding them to a separate
 * queue to be retried later.
 * @module lib/tipper
 */
import logger from './logger.js'

class Tipper {
    constructor() {
        this.tipQueue = []
        this.failQueue = []
        this.lastGame = undefined
        this.session = undefined
        this.bot = undefined
        this.tippingInProgress = false
    }

    /**
     * Gets the command to send to the server to tip a player.
     * @param {object} newTip The tip to send
     * @returns {string} The command to send
     * @private
     */
    _getCommand(newTip) {
        if (newTip.gamemode !== 'all') {
            return `/tip ${newTip.username} ${newTip.gamemode}`
        }
        return '/tipall'
    }

    /**
     * If the tip queue is empty, this function checks for failed tips and requests
     * new players for those games. This is to ensure that all active boosters are
     * tipped.
     * @private
     */
    _checkFailedTips() {
        if (this.tipQueue.length === 0 && this.failQueue.length > 0) {
            logger.debug(`Found failed tips in ${this.failQueue}, requesting new players...`)
            this.session.sendTipRequest(this.failQueue)
            this.failQueue = []
        }
    }

    /**
     * Tips players in the queue at a regular interval.
     * @private
     */
    _tip() {
        if (this.tippingInProgress) return
        if (this.tipQueue.length === 0) {
            this._checkFailedTips()
            return
        }

        this.tippingInProgress = true

        const doTip = () => {
            if (this.tipQueue.length === 0) {
                this.tippingInProgress = false
                this._checkFailedTips()
                return
            }

            const newTip = this.tipQueue.shift()
            this.lastGame = newTip.gamemode

            const command = this._getCommand(newTip)
            logger.debug(command)
            this.bot.chat(command)
            setTimeout(doTip, this.session.tipCycleRate * 1000)
        }
        doTip()
    }

    /**
     * Updates the tip queue with new players to tip.
     * @param {object[]} tips The tips to add to the queue
     */
    updateQueue(tips) {
        this.tipQueue = tips
        this._tip()
    }

    /**
     * If a tip fails, this function adds the game to the fail queue so that it can
     * be retried later.
     */
    tipFailed() {
        this.failQueue.push(this.lastGame)
    }

    /**
     * Initializes the tipper by setting the bot and session, and sending the first
     * tip request.
     * @param {object} _bot The mineflayer bot
     * @param {object} autotipSession The autotip session
     */
    initTipper(_bot, autotipSession) {
        this.session = autotipSession
        this.bot = _bot
        this.session.sendTipRequest()
    }
}

export default new Tipper()
