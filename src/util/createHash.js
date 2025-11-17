const crypto = require('crypto')

/**
 * The Minecraft session server uses a custom hex digest format that includes
 * negative hashes. This function performs two's compliment on a buffer to
 * replicate that behavior.
 * @param {Buffer} buffer The buffer to perform two's compliment on
 */
function performTwosCompliment(buffer) {
    let carry = true
    let i
    let newByte
    let value
    for (i = buffer.length - 1; i >= 0; i -= 1) {
        value = buffer.readUInt8(i)
        newByte = ~value & 0xff
        if (carry) {
            carry = newByte === 0xff
            buffer.writeUInt8(carry ? 0 : newByte + 1, i)
        } else {
            buffer.writeUInt8(newByte, i)
        }
    }
}

/**
 * Creates a Minecraft-style hex digest for authenticating with the session server.
 * @param {string} str The string to digest
 * @returns {string} The hex digest
 */
function mcHexDigest(str) {
    const hash = Buffer.from(crypto.createHash('sha1').update(str).digest(), 'binary')
    // check for negative hashes
    const negative = hash.readInt8(0) < 0
    if (negative) performTwosCompliment(hash)
    let digest = hash.toString('hex')
    // trim leading zeroes
    digest = digest.replace(/^0+/g, '')
    if (negative) digest = `-${digest}`
    return digest
}

module.exports = str => mcHexDigest(str)
