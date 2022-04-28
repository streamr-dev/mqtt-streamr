#!/usr/bin/env node
const StreamrClient = require('streamr-client')
const mqtt = require('mqtt')
const jsonata = require("jsonata")
const DataTimeoutUtil = require('../src/DataTimeoutUtil')
const Logger = require('../src/Logger')

require('console-stamp')(console, { pattern: 'yyyy-mm-dd HH:MM:ss' });

const streamCreateFutures = {}

const options = require('yargs')
    .usage('Usage: $0 --mqtt-url [mqtt-url] --topic /path [other options]')
    .option('mqtt-url', {
        describe: 'The MQTT server URL to connect to, for example wss://some-mqtt-server.com',
        default: undefined
    })
    .option('topic', {
        type: 'array',
        describe: 'Topic/path to subscribe to. Give this option multiple times to subscribe to several topics. Can include wildcards.',
    })
    .option('private-key', {
        default: undefined,
        describe: 'Ethereum private key of the user to authenticate as.',
    })
    .option('verbose', {
        type: 'boolean',
        default: false,
        describe: 'Give this option to print all the data to the console.',
    })
    .option('public', {
        type: 'boolean',
        describe: 'Give this option to make all created streams publicly readable. By default, created streams are private to you.',
        default: false,
    })
    .option('stream-id-template', {
        default: '/$topic',
        describe: 'Give this option to set how the stream id is constructed from the MQTT topic. The string \'$topic\' in the template is replaced by the actual topic. Example: "mydomain.eth/$topic". To have all data go to a single stream, just define the id of the stream here.',
    })
    .option('stream-id', {
        describe: 'If this option is given, all data will be published to a single pre-existing stream with this id. Topic auto-creation will be disabled.',
    })
    .option('topic-levels', {
        type: 'number',
        default: undefined,
        describe: 'Number of topic levels to include when auto-creating streams, while truncating subsequent topic hierarchy levels. For example, data in /europe/switzerland and /europe/finland would both be produced to stream /europe if the topic-level is set to 1.'
    })
    .option('transform', {
        default: undefined,
        describe: 'Give this option to transform JSON messages before producing them to Streamr. This option follows the JSONata syntax. By default no transform is applied.',
    })
    .option('log-interval', {
        type: 'number',
        default: 60,
        describe: 'Stats logging interval in seconds.'
    })
    .option('reconnect-on-data-timeout', {
        type: 'number',
        default: 900,
        describe: 'If no data is received for this period of time, try to reconnect to the MQTT broker. The default is 15 minutes. Set to 0 to disable.'
    })
    .option('dry-run', {
        type: 'boolean',
        default: false,
        describe: 'If this option is given, the script doesn\'t really create streams or produce data to Streamr. It just reads from the MQTT broker and logs the data to console.'
    })
    .demandOption(['mqtt-url','topic','private-key'])
    .argv;

/**
 * Streamr connection setup
 */

const clientConfig = {
    auth: {
        privateKey: options['private-key']
    }
}

/**
 * Utils
 */

const logger = new Logger(options['log-interval'] * 1000)

let dataTimeoutUtil
if (options['reconnect-on-data-timeout'] > 0) {
    dataTimeoutUtil = new DataTimeoutUtil(options['reconnect-on-data-timeout'] * 1000, () => {
        console.log(`No data received for ${options['reconnect-on-data-timeout']} seconds. Reconnecting MQTT client...`)

        if (mqttClient) {
            mqttClient.end(true)
        }
        connectMqttClient()
        dataTimeoutUtil.reset()
    })
}

const truncateTopic = (topic, levels) => {
    if (levels > 0) {
        const parts = topic.split('/')
        return parts.slice(0, levels+1).join('/')
    } else {
        return topic
    }
}

const transform = (options['transform'] ? jsonata(options['transform']) : null)

/**
 * Stream client setup
 */

const streamrClient = new StreamrClient(clientConfig)

/**
 * MQTT connection setup
 */
let mqttClient
const connectMqttClient = () => {
    console.log('Connecting to ', options['mqtt-url'])
    mqttClient = mqtt.connect(options['mqtt-url'])

    mqttClient.on('error', (err) => {
        console.error(err)
    })

    mqttClient.on('connect', () => {
        console.log('MQTT client connected to ', options['mqtt-url'])
        options['topic'].forEach((topic) => {
            console.log('Subscribing to topic ', topic)
            mqttClient.subscribe(topic, (err, granted) => {
                if (err) {
                    console.error(err)
                }
                console.log(`MQTT client subscribed: ${JSON.stringify(granted)}`)
            })
        })
    })

    /**
     * Message handling
     */
    mqttClient.on('message', async (topic, unparsedMessage) => {
        if (dataTimeoutUtil) {
            dataTimeoutUtil.reset()
        }

        let parsedMessage
        try {
            parsedMessage = JSON.parse(unparsedMessage)
        } catch (err) {
            console.error('Message was not valid JSON. Ignoring: ', unparsedMessage)
            return
        }

        if (transform) {
            parsedMessage = transform.evaluate(parsedMessage)
        }

        let stream
        if (options['stream-id']) {
            stream = options['stream-id']
        } else if (!options['dry-run']) {
            // Stream auto-creation
            const streamId = options['stream-id-template'].replace('$topic', truncateTopic(topic, options['topic-levels']))

            if (!streamCreateFutures[streamId]) {
                console.log('Getting or creating stream: ', streamId)
                streamCreateFutures[streamId] = streamrClient.getOrCreateStream({
                    id: streamId
                })
                if (options['public']) {
                    const stream = await streamCreateFutures[streamId]
                    const publicRead = await stream.hasPermission('read', null)

                    if (!publicRead) {
                        console.log(`Making stream ${streamId} public`)
                        await stream.grantPermission('read', null)
                    }
                }
            }

            stream = await streamCreateFutures[streamId]
        }

        if (options['verbose']) {
            console.log(`${options['dry-run'] ? 'DRY-RUN: ' : ''}${topic} -> ${stream && stream.id || stream || '(dry-run)'}\n:${JSON.stringify(parsedMessage)}`)
        }

        try {
            if (!options['dry-run']) {
                await streamrClient.publish(stream, parsedMessage)
            }
            logger.successIncrement()
        } catch (err) {
            logger.errorIncrement()
        }

    })
}

connectMqttClient()
