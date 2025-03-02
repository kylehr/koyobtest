let cluster = require('node:cluster');
let os = require('node:os');
let availableParallelism = os.availableParallelism;
let process = require('node:process');

const numCPUs = availableParallelism();
console.log(`parellelism: ${numCPUs}`);

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running.`);
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    // Receive messages from workers and handle them in the Primary process.
    worker.on('message', msg => {
      console.log(
        `Primary ${process.pid} received a message from worker ${worker.process.pid}:`,
        msg
      );
    });
  }
} else if (cluster.isWorker) {
  console.log(`Worker ${process.pid} is active.`);
  // Send a message to the Primary process.
  process.send({
    msgFromWorker: `Message sent from worker ${process.pid}.`,
  });
}
