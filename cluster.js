// Example of clustered expressjs.
const cluster = require('cluster');
const express = require('express');
const path = require('path');

const port = 3000;
const root = path.dirname(__dirname);
const cCPUs = require('os').cpus().length;

if (cluster.isMaster) {
    // Create a worker for each CPU
    for (let i = 0; i < cCPUs; i++) {
        cluster.fork();
    }
    cluster.on('online', function (worker) {
        console.log('Worker ' + worker.process.pid + ' is online.');
    });
    cluster.on('exit', function (worker, code, signal) {
        console.log('worker ' + worker.process.pid + ' died.');
    });
} else {
    const app = express();
    const routes = require('./routes')(app);
    app.use(express.bodyParser()).listen(port);
}
