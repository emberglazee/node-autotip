/**
 * @fileoverview This file manages the process of tipping players. It maintains a
 * queue of players to tip, and sends the tip commands to the server at a
 * regular interval. It also handles failed tips by adding them to a separate
 * queue to be retried later.
 * @module lib/tipper
 */
const logger = require('./logger')

let tipQueue = [], failQueue = []
let lastGame, session, bot
let tippingInProgress = false

/**
 * Gets the command to send to the server to tip a player.
 * @param {object} newTip The tip to send
 * @returns {string} The command to send
 */
function getCommand(newTip) {
    if (newTip.gamemode !== 'all') {
        return `/tip ${newTip.username} ${newTip.gamemode}`
    }
    return '/tipall'
}

/**
 * If the tip queue is empty, this function checks for failed tips and requests
 * new players for those games. This is to ensure that all active boosters are
 * tipped.
 */
function checkFailedTips() {
    if (tipQueue.length === 0 && failQueue.length > 0) {
        logger.debug(`Found failed tips in ${failQueue}, requesting new players...`)
        session.sendTipRequest(failQueue)
        failQueue = []
    }
}

/**
 * Tips players in the queue at a regular interval.
 */
function tip() {
    if (tippingInProgress) return
    if (tipQueue.length === 0) {
        checkFailedTips()
        return
    }

    tippingInProgress = true

    function doTip() {
        if (tipQueue.length === 0) {
            tippingInProgress = false
            checkFailedTips()
            return
        }

        const newTip = tipQueue.shift()
        lastGame = newTip.gamemode

        const command = getCommand(newTip)
        logger.debug(command)
        bot.chat(command)
        setTimeout(doTip, session.tipCycleRate * 1000)
    }
    doTip()
}

/**
 * Updates the tip queue with new players to tip.
 * @param {object[]} tips The tips to add to the queue
 */
function updateQueue(tips) {
    tipQueue = tips
    tip()
}

/**
 * If a tip fails, this function adds the game to the fail queue so that it can
 * be retried later.
 */
function tipFailed() {
    failQueue.push(lastGame)
}

/**
 * Initializes the tipper by setting the bot and session, and sending the first
 * tip request.
 * @param {object} _bot The mineflayer bot
 * @param {object} autotipSession The autotip session
 */
function initTipper(_bot, autotipSession) {
    session = autotipSession
    bot = _bot
    session.sendTipRequest()
}

module.exports = {
    updateQueue,
    tipFailed,
    initTipper
}
