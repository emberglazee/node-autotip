const logger = require('./logger')

let tipQueue = []
let failQueue = []
let lastGame
let session
let bot
let tippingInProgress = false

function getCommand(newTip) {
    if (newTip.gamemode !== 'all') {
        return `/tip ${newTip.username} ${newTip.gamemode}`
    }
    return '/tipall'
}

function checkFailedTips() {
    if (tipQueue.length === 0 && failQueue.length > 0) {
        logger.debug(`Found failed tips in ${failQueue}, requesting new players...`)
        session.sendTipRequest(failQueue)
        failQueue = []
    }
}

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

function updateQueue(tips) {
    tipQueue = tips
    tip()
}

function tipFailed() {
    failQueue.push(lastGame)
}

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
