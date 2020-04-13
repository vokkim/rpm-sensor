const { Gpio } = require('onoff')
const dgram = require('dgram')
const client = dgram.createSocket('udp4')

const PIN = 17
const ZERO_SPEED_INTERVAL = 3000
const DATA_RATE = 500
const SAMPLE_SIZE = 5

const switchIn = new Gpio(PIN, 'in', 'falling')

let lastValues = []
let intervalId = null

module.exports = function (app) {
  function start(options) {
    app.debug('Plugin started')
    switchIn.watch( (err, value) => {
      if( err ) {
        return console.log( 'Error', err )
      }

      lastValues.push(Date.now())
      if (lastValues.length > SAMPLE_SIZE) {
        lastValues.shift()
      }
    })

    intervalId = setInterval(() => {
      if (lastValues.length > 0 && lastValues[lastValues.length-1] < (Date.now() - ZERO_SPEED_INTERVAL)) {
        lastValues = []
      }
      calculateAndEmitRpm(lastValues)
    }, DATA_RATE)
  }

  function stop() {
    app.debug('Plugin stopped')
    switchIn.unwatchAll()
    clearInterval(intervalId)
  }

  return {
    id: 'rpm-plugin',
    name: 'RPM',
    schema: {},
    start,
    stop
  }
}


function measure() {
  console.log('Running')

}

function calculateAndEmitRpm(lastValues) {
  if (lastValues.length < SAMPLE_SIZE) {
    emit(0)
  } else {
    const rpm = (6000 / (lastValues[lastValues.length-1] - lastValues[0])) * lastValues.length
    emit(rpm)
  }
}

function emit(rpm) {
  console.log(`RPM ${rpm}`)
  const delta = {
    updates: [{
      timestamp: (new Date()).toISOString(),
      values: [{path: 'traktoripi.sensor.rpm',
      value: rpm
    }]}]
  }
  client.send(Buffer.from(JSON.stringify(delta)), 10500, 'localhost', () => {})
}