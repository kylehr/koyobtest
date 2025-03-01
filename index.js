const util = require('util');
const exec = util.promisify(require('child_process').exec);

async function ls() {
  const { stdout, stderr } = await exec(process.env.COMMAND);
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
}

async function t() {
  let i = 3;
  do {
      console.log(`test log ${new Date()} ${JSON.stringify(process.env)}`);
      await new Promise(resolve => setTimeout(resolve, 20000)); 
      i--;
    } while (i);
    await ls();
  }
t()
