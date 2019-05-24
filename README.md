# mqtt-streamr

A command line utility for bridging data from a MQTT broker to [Streamr](https://www.streamr.com) with
stream auto-creation and other useful features.

## Installation

```
npm install -g @streamr/mqtt-streamr
```

## Usage
To get help, including a list of all the command-line options, simply run `mqtt-streamr`.

Minimal usage: `mqtt-streamr --mqtt-url [mqtt-url] --topic [path] --private-key [key]`

## Required options

`--mqtt-url [url]`

The MQTT server URL to connect to, for example `--mqtt-url wss://some-mqtt-server.com`.

`--topic [topic]`

Topic/path to subscribe to. Give this option multiple times to subscribe to several topics.
Can include wildcards. Example: `--topic /home/bedroom/lamp`

`--private-key [key]`

Ethereum private key of the user to authenticate as. Either `--api-key` or `--private-key` must be given.

`--api-key [key]`

API key of the user to authenticate as. Either `--api-key` or `--private-key` must be given.

## Additional options

`--verbose`

Give this option to print all the data to the console.

`--streamr-url [url]`

The Streamr websocket API URL, for example `wss://www.streamr.com/api/v1/ws`. If not defined,
the default value in the Streamr client library is used.

`--public`

Give this option to make all created streams publicly readable. By default, created streams are
private to you.

`--stream-name-template [template]`

Default: `$topic`

Give this option to set how the stream name is constructed from the MQTT topic. 
The string `$topic` in the template is replaced by the actual topic. 
Example: `My MQTT topic: $topic`. 

Note that you can direct all data go to a single stream by just defining its name **without** the
placeholder `$topic` in it.

`--topic-levels [num]`

Default: (unlimited)

Number of topic levels to include when auto-creating streams, while truncating subsequent 
topic hierarchy levels. For example, data in `/europe/switzerland` and `/europe/finland` 
would both be produced to stream `/europe` if the topic-level is set to 1.

`--transform [jsonata-syntax]`

Give this option to transform JSON messages before producing them to Streamr. This option follows the 
[JSONata syntax](https://docs.jsonata.org). By default no transform is applied.

`--log-interval [num]`

Default: 60

Stats logging interval in seconds.

`--reconnect-on-data-timeout [num]`

Default: 900

If no data is received for this period of time, try to reconnect to the MQTT broker. The default is 15 minutes. 
Set to 0 to disable.

`--dry-run`

If this option is given, the script doesn't really create streams or produce data to Streamr.
It just reads from the MQTT broker and logs the data to console.
