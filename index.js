const express			= require('express')
const app			= express()
const cache			= require('express-cache-ctrl');
const serve_index		= require('serve-index');

const cluster			= require('node:cluster');
const os			= require('node:os');
const availableParallelism	= os.availableParallelism;
const process			= require('node:process');

const jy			= require( './test_load.js');
const _				= require('lodash');
const path			= require('path');
const fetchPkg			= 'node_modules/whatwg-fetch/dist/fetch.umd.js';
const fs			= require('fs');
const fetch_code		= fs.readFileSync(fetchPkg, 'utf-8');

const numCPUs = availableParallelism();

let number_gamers = 1;
let site = 'https://tableteacher.com';
let number_sequences = process.env.STREAMS == 'CPUS' ? parseInt(numCPUs) : (process.env.STREAMS ? parseInt(process.env.STREAMS) : 1);
let number_iterations = process.env.ITERATIONS ? parseInt(process.env.ITERATIONS) : 1;
if (cluster.isPrimary) {
  let  = log_fname = `${(new Date()).toISOString().substring(0,19).replaceAll(':', '.')}.log`;
  let  = err_fname = `${(new Date()).toISOString().substring(0,19).replaceAll(':', '.')}.err`;
  let number_errors = 0;

  console.log(`parellelism: ${number_sequences}`);
  //console.log(`__dirname: ${__dirname}`);
  //console.log(`Primary ${process.pid} is running.`);
  
  let games_remaining = number_sequences * number_iterations;
  let this_sequence = 0;

  for (; this_sequence < number_sequences; this_sequence++) {
    process.env.sequence_number = this_sequence;
    const worker = cluster.fork();
    worker.on('message', message => {
      console.log('receive msg');
      let stats = JSON.parse(message);
      if (stats.logs) {
        let start_time = new Date(stats.start);
        _.each(stats.logs, journey_step => { 
          let event_time = new Date(journey_step[2]);
          let elapsed_time_s = (event_time - start_time) / 1000;
          fs.appendFileSync(log_fname, `,${number_sequences},${number_iterations},${stats.sequence_number + 1},${stats.iteration_number + 1},${journey_step[0]},${journey_step[1]},${elapsed_time_s}\n`)  });
        }
      else {
        number_errors++;
        fs.appendFileSync(err_fname, `sequence_number=${stats.sequence_number + 1},iteration_number=${stats.iteration_number + 1} error=${stats.error} stack=${stats.stack}\n`);
        }
      games_remaining--;
      if (games_remaining === 0) console.log('all games finished, ${number_errors} errors');
    });
  }

  const port = process.env.PORT || 3000
  app.use(express.static(__dirname + "/"))
  app.use('/', serve_index(__dirname + "/"))
  app.use('/', cache.disable());
  app.use('/ls/', cache.disable());
  app.get('/togo/', (req, res) => {
    res.send(`games_remaining=${games_remaining} this_sequence=${this_sequence}`);
    });
  app.get('/ls/:glob', (req, res) => {
    let glob = req.params.glob ? req.params.glob : '.*';
    const re = new RegExp(`^${glob}$`);
    let result = "";
    fs.readdirSync(".").forEach(file => {
      if (file.match(re)) result += `<a href="/${file}">${file}</a><br/>`
      });
    res.send(result)
    });

  app.listen(port, () => {
    console.log(`App is listening on port ${port}`)
    })
  } 
else if (cluster.isWorker) {
  process_xml()
}

async function process_xml() {
  let xml = fs.readFileSync('./guest.xml', 'utf-8');
  let parms = {number_gamers: number_gamers};
  jy.set_fetch_code(fetch_code);
  jy.process_journey_xml(xml);
  let console_constructor = console.Console;
  let start = new Date();

  // Run each iteration.
  for (let iteration = 0; iteration < number_iterations; iteration++) {
    try {
      console.log(`starting iteration ${iteration} of ${number_iterations}`);
      let stream = fs.createWriteStream(`${__dirname}/sequence_${process.env.sequence_number + 1}_of_${number_sequences}_iteration_${iteration + 1}_of_${number_iterations}.log`, {flags:'a'});
      let file_console = new console_constructor(stream, stream);
      global.console = file_console;
      console.log(`run steps`);
      let logs = await jy.run_steps(site, parms, 'aaaaaaa', 'bbbbbbbb');
      console.log(`send success`);
      process.send(JSON.stringify({ iteration_number: iteration, sequence_number: process.env.sequence_number, logs: logs, start: start}));
      }
    catch (err) {
      let obj = {};
      Error.captureStackTrace(obj);
      console.log(`send error`);
      let msg = JSON.stringify({ iteration_number: iteration, sequence_number: process.env.sequence_number, error: err.toString(), stack: obj.stack});
      console.log(msg);
      console.log(JSON.stringify(msg));
      process.send(msg);
      }
    }
}
