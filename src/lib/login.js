/**
 * @fileoverview This file handles the two-step authentication process required
 * to use the autotip service. First, it authenticates with Mojang's session
 * server, and then it uses the resulting session to log in to the autotip server.
 * @module lib/login
 */
import axios from 'axios'
import os from 'os'
import bigInt from 'big-integer'
import { removeDashes, headers } from '../util/utility.js'
import logger from './logger.js'
import createHash from '../util/createHash.js'
import Session from './session.js'
import { getTipCount } from './tracker.js'

/**
 * Generates a server hash for authentication with Mojang's session server.
 * @param {string} uuid The user's UUID
 * @returns {string} The server hash
 */
function getServerHash(uuid) {
    const salt = bigInt.randBetween('0', '1.3611295e39').toString(32)
    return createHash(uuid + salt)
}

/**
 * Joins a Minecraft server to authenticate with Mojang's session server.
 * @param {object} params The parameters for joining the server
 * @returns {Promise<boolean>} Whether the server was joined successfully
 */
async function joinServer(params) {
    const options = {
        url: 'https://sessionserver.mojang.com/session/minecraft/join',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        data: params
    }
    try {
        const res = await axios(options)
        if (![200, 204].includes(res.status)) {
            logger.error(`Error ${res.status} during authentication: Session servers down?`)
            throw res.status
        }
        return true
    } catch (err) {
        logger.error(`Error ${err} during authentication: Session servers down?`)
        throw err
    }
}

/**
 * Logs in to the autotip server using the session from Mojang.
 * @param {string} uuid The user's UUID
 * @param {object} session The user's session
 * @param {string} hash The server hash
 * @returns {Promise<object>} The response from the autotip server
 */
async function autotipLogin(uuid, session, hash) {
    const tipCount = await getTipCount(uuid)
    const url = `https://autotip.sk1er.club/login?username=${session.selectedProfile.name}&uuid=${removeDashes(uuid)}&tips=${tipCount + 1}&v=2.1.0.6&mc=1.8.9&os=${os.type()}&hash=${hash}`
    try {
        const res = await axios.get(url, { headers })
        return res.data
    } catch (err) {
        logger.error(`Unable to login to autotip: ${err}`)
        throw err
    }
}

/**
 * Logs in to the autotip service by first authenticating with Mojang, then
 * with the autotip server.
 * @param {string} uuid The user's UUID
 * @param {object} session The user's session
 * @returns {Promise<Session>} The autotip session
 */
async function login(uuid, session) {
    const { accessToken } = session
    logger.debug(`Trying to log in as ${removeDashes(uuid)}`)

    const hash = getServerHash(removeDashes(uuid))
    logger.debug(`Server hash is: ${hash}`)

    await joinServer({
        accessToken,
        selectedProfile: removeDashes(uuid),
        serverId: hash
    })
    logger.debug('Successfully created Mojang session!')

    const body = await autotipLogin(uuid, session, hash)
    let json = {}
    try {
        json = body
    } catch (e) {
        logger.warn(`Invalid json response from autotip login server! ${e}`)
    }
    if (!json.success) {
        logger.error(`Autotip login failed! ${JSON.stringify(body)}`)
        throw body
    }
    logger.debug(`Autotip session: ${JSON.stringify(body)}`)
    return new Session(json)
}

export default login
