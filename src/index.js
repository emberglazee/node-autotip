
/**
 * @fileoverview This is the main file for node-autotip. It creates the
 * Mineflayer bot, connects to the server, and handles chat messages.
 * @module index
 */
const mineflayer = require('mineflayer')
const config = require('../config')
const login = require('./lib/login')
const logger = require('./lib/logger')
const { tipIncrement, getLifetimeStats } = require('./lib/tracker')
const tipper = require('./lib/tipper')
const { toANSI, sleep } = require('./util/utility')
const credentials = require('../credentials.json')

logger.info('Starting...')

let bot, uuid, autotipSession

const options = {
    host: 'mc.hypixel.net',
    port: 25565,
    version: '1.8.9',
    auth: credentials.legacy ? 'mojang' : 'microsoft',
    username: credentials.username,
    password: credentials.password
}

/**
 * Gets the UUID of the bot.
 * @returns {string} The UUID of the bot
 */
function getUUID() {
    return bot._client.session.selectedProfile.id
}

/**
 * Sets the language of the bot by sending the `/lang {language}` command.
 * @param {string} [language='english'] The language to set
 */
function setLang(language = 'english') {
    logger.info(`Changing language to ${language}`)
    bot.chat(`/lang ${language}`)
}

/**
 * When a player is tipped, the details of the tip are hidden in the hover data
 * of the message. This function extracts that data.
 * @param {object} message The message to get the hover data from
 * @returns {string[]} The hover data
 */
function getHoverData(message) {
    const arr = message.hoverEvent.value.text.split('\n')
    arr.shift()
    return arr
}

/**
 * Logs the rewards from a tip to the console, if enabled in the config.
 * @param {string[]} [arr=[]] The array of rewards
 */
function logRewards(arr = []) {
    if (config.PRINT_REWARDS) {
        arr.forEach(line => {
            logger.game(toANSI(`${line}§r`))
        })
    }
}

/**
 * Logs chat messages to the console, with the option to hide certain messages
 * to reduce spam.
 * @param {object} message The message to log
 */
function chatLogger(message) {
    const str = message.toString()
    const ansi = message.toAnsi()
    const regex = /You've already tipped someone in the past hour in [\w\s]*! Wait a bit and try again!/
    const blacklist = [
        'A kick occurred in your connection, so you have been routed to limbo!',
        'Illegal characters in chat',
        'That player is not online, try another user!',
        'No one has a network booster active right now! Try again later.',
        'You already tipped everyone that has boosters active, so there isn\'t anybody to be tipped right now!',
        'You\'ve already tipped someone in the past hour in',
        'You are AFK. Move around to return from AFK.'
    ]
    if (config.HIDE_TIP_MESSAGES) {
        if (blacklist.includes(str) || regex.test(str)) {
            logger.debug(ansi)
            return
        }
    }
    if (config.HIDE_JOIN_MESSAGES) {
        if (/(^Friend|Guild) > [\w]+ (left|joined)\.$/.test(str)) {
            logger.debug(ansi)
            return
        }
    }
    if (config.HIDE_MVP_JOIN_MESSAGES) {
        if (/^\[MVP\++]\s\S+\sjoined the lobby!$/.test(str) || /^\s*>>> \[MVP\++]\s\S+\sjoined the lobby! <<<\s*$/.test(str)) {
            logger.debug(ansi)
            return
        }
    }
    if (config.HIDE_WATCHDOG_MESSAGES) {
        if (
            /^\[WATCHDOG ANNOUNCEMENT]$/.test(str) ||
            /^Watchdog has banned [0-9,]+ players in the last 7 days\.$/.test(str) ||
            /^Staff have banned an additional [0-9,]+ in the last 7 days\.$/.test(str) ||
            /^Blacklisted modifications are a bannable offense!$/.test(str) || str === ''
        ) {
            logger.debug(ansi)
            return
        }
    }
    logger.game(ansi)
}

/**
 * This function is called when the bot logs in. It sets the UUID, changes the
 * language, displays lifetime stats, and initializes the autotip session.
 */
async function onLogin() {
    uuid = getUUID(bot)
    setLang()
    logger.debug(`Logged on ${options.host}:${options.port}`)

    const { xp, coins, karma } = await getLifetimeStats(uuid)
    const stats = `You've earned §3${xp} Exp§r, §6${coins} Coins§r and §d${karma} Karma§r using §bnode-autotip§r`

    logger.info(toANSI(stats))
    await sleep(1000)

    const { session } = bot._client
    if (autotipSession === undefined) {
        autotipSession = await login(uuid, session)
    }
    tipper.initTipper(bot, autotipSession)
}

/**
 * This function is called when a chat message is received. It parses the message
 * and, if it is a tip message, it updates the stats and logs the rewards.
 * @param {object} message The message object
 * @param {string} position The position of the message
 */
function onMessage(message, position) {
    if (position !== 'chat') return
    const msg = message.toString()
    chatLogger(message)

    if (msg.startsWith('You tipped')) {
        const arr = getHoverData(message)
        const tips = (/tipped \w* players in (\d*)/.exec(msg) !== null)
            ? /tipped \w* players in (\d*)/.exec(msg)[1]
            : 1
        const karma = (tips > 1 && arr.some(line => line.includes('Quakecraft')))
            ? (tips - 5) * config.TIP_KARMA
            : tips * config.TIP_KARMA
        arr.push(`§d+${karma} Karma`)
        tipIncrement(uuid, { type: 'sent', amount: tips }, arr)
        logRewards(arr)
    }

    if (msg.startsWith('You were tipped')) {
        const arr = getHoverData(message)
        try {
            const tips = /by (\d*) players?/.exec(msg)[1]
            tipIncrement(uuid, { type: 'received', amount: tips }, arr)
        } catch (e) {
            //
        }
        logRewards(arr)
    }

    if (msg.startsWith('That player is not online, try another user!')
    || msg.startsWith('You\'ve already tipped that person today')
    || msg.startsWith('Can\'t find a player by the name of')) {
        tipper.tipFailed()
    }
}

/**
 * Initializes the bot and sets up event listeners.
 */
(function init() {
    bot = mineflayer.createBot(options)
    logger.info('Logging in...')

    bot._client.once('session', session => options.session = session)
    bot.once('login', onLogin)
    bot.on('message', onMessage)
    bot.on('kicked', reason => {
        logger.info(`Kicked for ${reason}`)
    })
    bot.once('end', () => setTimeout(init, 10000))
}())

/**
 * Gracefully shuts down the bot when a kill signal is received. This is to
 * ensure that the autotip session is logged out and the language is changed
 * back to the user's preferred language.
 */
async function gracefulShutdown() {
    logger.info('Received kill signal, shutting down gracefully.')

    // Change language to a preferred one. Need to leave limbo first to run the command.
    bot.chat('/hub')
    await sleep(1000)

    setLang(config.CHANGE_LANGUAGE)
    await sleep(1000)

    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down')
        process.exit()
    }, 10 * 1000)

    try {
        await autotipSession.logOut()
        logger.info('Closed out remaining connections.')
        process.exit()
    } catch (e) {
        logger.warn('Closing without establishing autotip session.')
        process.exit()
    }
}
// listen for TERM signal .e.g. kill
process.once('SIGTERM', gracefulShutdown)
// listen for INT signal e.g. Ctrl-C
process.once('SIGINT', gracefulShutdown)
