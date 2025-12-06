
/**
 * @fileoverview This is the main file for node-autotip. It creates the
 * Mineflayer bot, connects to the server, and handles chat messages.
 * @module index
 */
import mineflayer from 'mineflayer'
import config from '../config.js'
import login from './lib/login.js'
import logger from './lib/logger.js'
import { tipIncrement, getLifetimeStats } from './lib/tracker.js'
import tipper from './lib/tipper.js'
import { toANSI, sleep } from './util/utility.js'
import credentials from '../credentials.json' with { type: 'json' }
import jsonfile from 'jsonfile'
import fs from 'fs/promises'
import path from 'path'
import axios from 'axios'

const regex = {
    chat: {
        friendGuild: /(^Friend|Guild) > [\w]+ (left|joined)\.$/,
        mvpJoin: /^\[MVP\++\]\s\S+\s(joined|slid into) the lobby!$/,
        mvpJoinAlt: /^\s*>>> \[MVP\++\]\s\S+\s(joined|slid into) the lobby! <<<\s*$/
    },
    watchdog: {
        announcement: /^\[WATCHDOG ANNOUNCEMENT\]$/,
        banned: /^Watchdog has banned [0-9,]+ players in the last 7 days\.$/,
        staffBanned: /^Staff have banned an additional [0-9,]+ in the last 7 days\.$/,
        blacklist: /^Blacklisted modifications are a bannable offense!$/
    },
    tipping: {
        cooldown: /You've already tipped someone in the past hour in [\w\s]*! Wait a bit and try again!/,
        tipped: /tipped [\w]* players in (\d*)/,
        tippedBy: /by (\d*) players?/
    }
}

logger.info('Starting...')
// Check for a Bun version first, since it fakes a Node.js version
if (process.versions.bun) {
    logger.info(`Detected Bun v${process.versions.bun}`)
} else if (process.versions.node) {
    logger.info(`Running Node.js v${process.versions.node}`)
}

async function showStats() {
    logger.info('Displaying player statistics...')
    const statsDir = './stats'
    try {
        const userDirs = await fs.readdir(statsDir).catch(err => {
            if (err.code === 'ENOENT') return []
            throw err
        })

        const userStatPromises = userDirs.map(async userDir => {
            const statFile = path.join(statsDir, userDir, 'tips.json')
            try {
                // check if it's a directory before reading
                const stats = await fs.stat(path.join(statsDir, userDir))
                if (!stats.isDirectory()) return null

                await fs.access(statFile)
                return jsonfile.readFile(statFile)
            } catch (e) {
                return null // File doesn't exist, not a directory, or other error
            }
        })

        const allStats = (await Promise.all(userStatPromises)).filter(s => s !== null)

        if (allStats.length === 0) {
            logger.info('No statistics found.')
            return
        }

        console.log('') // for spacing
        allStats.forEach(stats => {
            const { username, tips_sent, tips_received, exp, karma, coins } = stats
            const totalCoins = Object.values(coins || {}).reduce((a, b) => a + b, 0)

            console.log(toANSI(`§e§lStats for ${username || 'Unknown User'}:`))
            console.log(toANSI(`  §bTips Sent: §f${tips_sent || 0}`))
            console.log(toANSI(`  §bTips Received: §f${tips_received || 0}`))
            console.log(toANSI(`  §3Total Exp Earned: §f${exp || 0}`))
            console.log(toANSI(`  §dTotal Karma Earned: §f${karma || 0}`))
            console.log(toANSI(`  §6Total Coins Earned: §f${totalCoins || 0}`))
            if (coins && Object.keys(coins).length > 0) {
                console.log(toANSI('  §6Coins per game:'))
                for (const [game, amount] of Object.entries(coins)) {
                    console.log(toANSI(`    §7- ${game}: §f${amount}`))
                }
            }
            console.log('') // for spacing
        })

    } catch (error) {
        logger.error('An error occurred while reading statistics:', error)
    }
}

if (process.argv.includes('--stats')) {
    showStats().then(() => process.exit(0))
}

let bot, uuid, autotipSession, pollingInterval, pauseReconnect = false, isFirstLogin = true

const options = {
    host: 'mc.hypixel.net',
    port: 25565,
    version: '1.8.9',
    auth: credentials.legacy ? 'mojang' : 'microsoft',
    username: credentials.username,
    password: credentials.password
}

/**
 * Gets the UUID for a given username from Mojang's API.
 * @param {string} username The username to get the UUID for.
 * @returns {Promise<string|null>} The UUID of the player, or null if not found.
 */
async function getPlayerUUID(username) {
    try {
        const response = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`)
        if (response.data && response.data.id) {
            return response.data.id
        }
        logger.warn(`Could not find UUID for username ${username}.`)
        return null
    } catch (error) {
        if (error.response && error.response.status === 404) {
            logger.error(`No user with the name "${username}" was found.`)
        } else {
            logger.error(`Error fetching UUID for ${username}:`, error)
        }
        return null
    }
}

/**
 * Checks if the player is online on Hypixel.
 * @param {string} playerUUID The UUID of the player to check.
 * @returns {Promise<boolean|null>} True if online, false if offline, null on error or no key.
 */
async function checkPlayerOnline(playerUUID) {
    if (!credentials.apiKey || credentials.apiKey === 'your-hypixel-api-key' || credentials.apiKey.trim() === '') {
        logger.debug('No valid Hypixel API key found, skipping online status check.')
        return null
    }

    try {
        const res = await axios.get(`https://api.hypixel.net/v2/status?uuid=${playerUUID}`, {
            headers: { 'API-Key': credentials.apiKey }
        })

        if (res.data.success) {
            return res.data.session.online
        }
        logger.warn('Hypixel API request for player status was not successful.')
        return false // assume offline
    } catch (error) {
        if (error.response && error.response.status === 403) {
            logger.error('Invalid Hypixel API key. Unable to check player status.')
        } else {
            logger.error('Error checking player status:', error)
        }
        return null // don't block on error
    }
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
    /** @type {string[]} */
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
        if (blacklist.includes(str) || regex.tipping.cooldown.test(str)) {
            logger.debug(ansi)
            return
        }
    }
    if (config.HIDE_JOIN_MESSAGES) {
        if (regex.chat.friendGuild.test(str)) {
            logger.debug(ansi)
            return
        }
    }
    if (config.HIDE_MVP_JOIN_MESSAGES) {
        if (regex.chat.mvpJoin.test(str) || regex.chat.mvpJoinAlt.test(str)) {
            logger.debug(ansi)
            return
        }
    }
    if (config.HIDE_WATCHDOG_MESSAGES) {
        if (
            regex.watchdog.announcement.test(str) ||
            regex.watchdog.banned.test(str) ||
            regex.watchdog.staffBanned.test(str) ||
            regex.watchdog.blacklist.test(str) || str === ''
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
        const tips = (regex.tipping.tipped.exec(msg) !== null)
            ? regex.tipping.tipped.exec(msg)[1]
            : 1
        const karma = (tips > 1 && arr.some(line => line.includes('Quakecraft')))
            ? (tips - 5) * config.TIP_KARMA
            : tips * config.TIP_KARMA
        arr.push(`§d+${karma} Karma`)
        tipIncrement(uuid, credentials.username, { type: 'sent', amount: tips }, arr)
        logRewards(arr)
    }

    if (msg.startsWith('You were tipped')) {
        const arr = getHoverData(message)
        try {
            const tips = regex.tipping.tippedBy.exec(msg)[1]
            tipIncrement(uuid, credentials.username, { type: 'received', amount: tips }, arr)
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
function startPollingForPlayerStatus() {
    if (pollingInterval) clearInterval(pollingInterval)

    const checkStatus = async () => {
        logger.debug('Checking player status...')
        try {
            const res = await axios.get(`https://api.hypixel.net/v2/status?uuid=${uuid}`, {
                headers: { 'API-Key': credentials.apiKey }
            })

            if (res.data.success && res.data.session.online === false) {
                logger.info('Player is now offline. Restarting bot.')
                clearInterval(pollingInterval)
                pollingInterval = null
                init()
            } else {
                logger.debug('Player is still online.')
            }
        } catch (error) {
            logger.error('Error checking player status:', error)
        }
    }

    // Check immediately, then every 5 minutes
    checkStatus()
    pollingInterval = setInterval(checkStatus, 5 * 60 * 1000)
}

async function init() {
    if (isFirstLogin) {
        isFirstLogin = false
        const playerUUID = await getPlayerUUID(credentials.username)
        if (playerUUID) {
            let isOnline = await checkPlayerOnline(playerUUID)
            if (isOnline === true) {
                logger.info('Player is currently online on Hypixel. Waiting for them to log off before starting the bot...')
                while (isOnline) {
                    await sleep(5 * 60 * 1000) // 5 minutes
                    isOnline = await checkPlayerOnline(playerUUID)
                    if (isOnline) {
                        logger.debug('Player is still online. Waiting...')
                    }
                }
                logger.info('Player is now offline. Starting bot.')
            }
        }
    }

    if (bot) bot.removeAllListeners()
    pauseReconnect = false

    bot = mineflayer.createBot(options)
    logger.info('Logging in...')

    bot.on('error', err => logger.error('A bot error occurred:', err))
    bot._client.once('session', session => { options.session = session })
    bot.once('login', onLogin)
    bot.on('message', onMessage)
    bot.on('kicked', reason => {
        logger.info(`Kicked! ${reason}`)
        try {
            const reasonJson = JSON.parse(reason)
            if (reasonJson.extra && reasonJson.extra[0].text === 'You logged in from another location!') {
                if (!credentials.apiKey || credentials.apiKey.trim() === 'your-hypixel-api-key') {
                    logger.warn('Got kicked for another login, but no apiKey found in credentials.json. Will use default reconnect logic.')
                    return
                }
                logger.info('Logged in from another location. Pausing bot and checking for player status every 5 minutes.')
                pauseReconnect = true
            }
        } catch {
            // Not JSON, ignore
        }
    })
    bot.once('end', reason => {
        logger.info(`Bot connection ended. Reason: ${reason || 'unknown'}.`)
        if (autotipSession) {
            autotipSession.logOut()
            autotipSession = undefined
        }

        if (pauseReconnect) {
            logger.info('Polling for player status.')
            startPollingForPlayerStatus()
        } else {
            logger.info('Restarting in 10 seconds...')
            setTimeout(init, 10000)
        }
    })
}
init()

/**
 * Gracefully shuts down the bot when a kill signal is received. This is to
 * ensure that the autotip session is logged out and the language is changed
 * back to the user's preferred language.
 */
function handleError(error, type) {
    logger.error(`A ${type} occurred:`, error)
    logger.info('Attempting to gracefully restart...')
    if (bot && bot.end) {
        bot.end(type)
    } else {
        logger.warn('Bot could not be ended gracefully. Restarting manually.')
        if (autotipSession) {
            autotipSession.logOut()
            autotipSession = undefined
        }
        setTimeout(init, 10000)
    }
}

process.on('uncaughtException', err => handleError(err, 'uncaught exception'))
process.on('unhandledRejection', reason => handleError(reason, 'unhandled rejection'))

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
