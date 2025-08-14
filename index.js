const express			= require('express')
const app			= express()
const cache			= require('express-cache-ctrl');
const serve_index		= require('serve-index');

const os			= require('node:os');
const availableParallelism	= os.availableParallelism;
const process			= require('node:process');

const jy			= require( './test_load.js');
const _				= require('lodash');
const path			= require('path');
const fetchPkg			= 'node_modules/whatwg-fetch/dist/fetch.umd.js';
const fs			= require('fs');
const fetch_code		= fs.readFileSync(fetchPkg, 'utf-8');

const uuid			= require('uuid');
const zl			= require("zip-lib");

const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

// Configure AWS S3 credentials and region
const s3Client = new S3Client(
  { region: process.env.AWS_REGION
  , credentials: 
    { accessKeyId: process.env.AWS_ACCESS_KEY_ID
    , secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  , endpoint: process.env.AWS_ENDPOINT_URL_S3
  });

const numCPUs = process.env.NUM_CPUS || availableParallelism();

//let site = 'http://localhost:5000';
let site_parm = process.env.SITE;
let site = site_parm ? site_parm : 'https://premier-janot-mathready-d26aed83.koyeb.app';
let number_sequences	= process.env.STREAMS	? parseInt(process.env.STREAMS)		: 1;
let number_iterations	= process.env.ITERATIONS? parseInt(process.env.ITERATIONS)	: 1;
let number_gamers	= process.env.GAMERS	? parseInt(process.env.GAMERS)		: 1;
let number_errors = 0;
let timeout = null;

let xml = fs.readFileSync('./guest.xml', 'utf-8');
let parms = {number_gamers: number_gamers, server_instance_id: process.env.FLY_MACHINE_ID, test_instance_id: `${process.env.FLY_MACHINE_ID}${uuid.v4().replace(/-/g, '')}`};
console.log(`test_instance_id ${parms.test_instance_id}`);
jy.set_fetch_code(fetch_code);
jy.process_journey_xml(xml);
let console_constructor = console.Console;

let games_remaining = number_sequences * number_iterations;
let this_sequence = 0;
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

console.log(`testing site ${site}`);
if (process.env.TIMEOUT) { timeout = setTimeout( () => zip_logs('./timeout.zip'), parseInt(process.env.TIMEOUT)  ) }
let log_fname = `${(new Date()).toISOString().substring(0,19).replaceAll(':', '.')}.log`;
let err_fname = `ERR.${(new Date()).toISOString().substring(0,19).replaceAll(':', '.')}.log`;
console.log(`number_gamers: ${number_gamers}, process.env.STREAMS: ${process.env.STREAMS}, process.env.ITERATIONS: ${process.env.ITERATIONS}, number_sequences: ${number_sequences}, number_iterations: ${number_iterations}, numCPUs: ${numCPUs}`)
console.log(`parellelism: ${number_sequences}`);

run_stuff();
async function run_stuff () {

  // Run each iteration.
  // FIXME: surely a loop does not work for functions that return promises.
  for (let iteration = 0; iteration < number_iterations; iteration++) {
    let iteration_number = iteration + 1;
    let sequence_number = 1; // Only support one sequence.
    let stream = fs.createWriteStream(`${__dirname}/sequence_${sequence_number}_of_${number_sequences}_iteration_${iteration_number}_of_${number_iterations}.log`, {flags:'a'});
    let file_console = new console_constructor(stream, stream);
    let start = new Date();
    try {
      console.log(`starting iteration ${iteration_number} of ${number_iterations}`);
      let logs = await jy.run_steps(site, parms, `stream ${sequence_number}`, `iteration ${iteration_number}`, file_console)
      console.log(`steps completed for stream ${sequence_number}`, `iteration ${iteration_number}`);
      let start_time = new Date(start);
      _.each(logs, journey_step => { 
        let event_time = new Date(journey_step[2]);
        let elapsed_time_s = (event_time - start_time) / 1000;
        fs.appendFileSync(log_fname, `,${number_sequences},${number_iterations},${sequence_number},${iteration_number},${journey_step[0]},${journey_step[1]},${elapsed_time_s}\n`);
        });
      console.log(`log creation completed successfully for ${sequence_number}`, `iteration ${iteration_number}`);
      }
    catch (error) {
      console.error(error);
      number_errors++;
      let err_msg = mk_error_message(error, iteration_number, sequence_number);
      file_console.error("err_msg", err_msg);
      fs.appendFileSync(err_fname, err_msg);
      console.log(`run completed with error for ${sequence_number}`, `iteration ${iteration_number}`);
      }
    }
  console.log(`all games finished, ${number_errors} errors, zipping logs...`);
  clearTimeout(timeout);
  zip_logs();
  } 


function mk_error_message(error, iteration_number, sequence_number) {
  let obj = {};
  Error.captureStackTrace(obj);
  let msg = JSON.stringify({ iteration_number, sequence_number, error: error.toString(), stack: obj.stack});
  return msg;
  }
  
function zip_logs(zip_name = "./logs.zip") {
  console.log(`starting zipping for ${zip_name}`);
  zip = new zl.Zip();
  fs.readdirSync('.').forEach(fname => {
    if (fname.slice(-4) == ".log") {
      console.log(`zipping ${fname}`);
      zip.addFile(`./${fname}`);
      }
    });
  if (process.env.BUCKET_NAME) zip.archive(zip_name).then(
    function () { 
      console.log(`zip file ${zip_name} created`); 
      uploadLargeFileToS3(zip_name, process.env.BUCKET_NAME, `logs-${Date.now()}-E${number_errors}-S${number_sequences}-I${number_iterations}-G${number_gamers}${zip_name.substring(2)}`)
      .then(() => console.log(`uploaded to s3`))
      .catch( (err) => { 
        console.log(`could not upload to s3`); 
        console.error(err); 
        });
      }, 
    function (err) { 
      console.log(err); 
      }
    );
  }

async function uploadLargeFileToS3(filePath, bucketName, s3Key) {
  const fileStream = fs.createReadStream(filePath);
  const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: bucketName,
                Key: s3Key,
                Body: fileStream,
            },
            partSize: 5 * 1024 * 1024, // Optional: specify part size (e.g., 5MB)
            queueSize: 4, // Optional: specify number of concurrent parts to upload
        });

        // Track upload progress (optional)
        upload.on("httpUploadProgress", (progress) => {
            console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
        });

        try {
            const data = await upload.done();
            console.log(`Large file uploaded successfully at ${data.Location}`);
            return data;
        } catch (err) {
            console.error("Error uploading file:", err);
            throw err;
        }
    }
