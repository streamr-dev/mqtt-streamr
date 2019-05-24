module.exports = class DataTimeoutUtil {
    constructor(timeout, callback) {
        this.timeout = timeout
        this.callback = callback
        this.startTimer()
    }

    startTimer() {
        this.timer = setTimeout(() => {
            this.callback(this.timeout)
        }, this.timeout)
    }

    reset() {
        clearTimeout(this.timer)
        this.startTimer()
    }
}