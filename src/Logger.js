module.exports = class Logger {
    constructor(interval) {
        this.interval = interval
        this.successCount = 0
        this.errorCount = 0
        setInterval(() => this.report(), this.interval)
    }

    successIncrement() {
        this.successCount++
    }

    errorIncrement() {
        this.errorCount++
    }

    report() {
        console.log(`Success: ${this.successCount}, Error: ${this.errorCount}`)
        this.successCount = 0
        this.errorCount = 0
    }
}