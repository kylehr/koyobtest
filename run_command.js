// test log Sat Mar 01 2025 04:17:18 GMT+0000 (Coordinated Universal Time) {"KOYEB_PRIVILEGED":"false","npm_config_user_agent":"npm/10.9.2 node/v22.14.0 linux x64 workspaces/false","NODE_VERSION":"22.14.0","KOYEB_PUBLIC_DOMAIN":"open-tallie-mathready-29e7e704.koyeb.app","YARN_VERSION":"1.22.22","HOSTNAME":"61d5daa0","KOYEB_REPLICA_INDEX":"0","npm_node_execpath":"/usr/local/bin/node","SHLVL":"2","npm_config_noproxy":"","HOME":"/root","npm_package_json":"/home/node/package.json","KOYEB_GIT_BRANCH":"main","KOYEB_INSTANCE_ID":"61d5daa0-2530-202a-0621-d3c6ad9f3323","KOYEB_ORGANIZATION_NAME":"mathready","npm_config_userconfig":"/root/.npmrc","npm_config_local_prefix":"/home/node","KOYEB_GIT_COMMIT_AUTHOR":"kylehr","KOYEB_REGIONAL_DEPLOYMENT_ID":"d321150b-ad08-492f-adf8-31e468da7501","KOYEB_SERVICE_NAME":"koyobtest","COLOR":"0","KOYEB_HYPERVISOR_ID":"1e12b738-58ff-ee8b-e568-51b0599189a9","KOYEB_DC":"fra1","npm_config_prefix":"/usr/local","npm_config_npm_version":"10.9.2","KOYEB_SERVICE_PRIVATE_DOMAIN":"koyobtest.open-tallie.internal","KOYEB_ORGANIZATION_ID":"baec2baf-5c6f-4402-aca2-a8cb8daf33ac","npm_config_cache":"/root/.npm","KOYEB_REGION":"fra","KOYEB_APP_NAME":"open-tallie","KOYEB_SERVICE_ID":"c03d53ef-bc28-4643-9f55-1f9f49f24be0","npm_config_node_gyp":"/usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js","PATH":"/home/node/node_modules/.bin:/home/node_modules/.bin:/node_modules/.bin:/usr/local/lib/node_modules/npm/node_modules/@npmcli/run-script/lib/node-gyp-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin","NODE":"/usr/local/bin/node","npm_package_name":"koyebtest","COMMAND":"poweroff","KOYEB_GIT_COMMIT_MESSAGE":"Stringify when logging env.","npm_lifecycle_script":"node index.js","KOYEB_GIT_REPOSITORY":"github.com/kylehr/koyobtest","npm_package_version":"1.0.0","npm_lifecycle_event":"start","KOYEB_APP_ID":"f5f3d8e1-a208-4150-941b-58384bb3d8df","KOYEB_GIT_SHA":"1cc9ceaeeda53a177f07b9f454eee059054eabf7","npm_config_globalconfig":"/usr/local/etc/npmrc","npm_config_init_module":"/root/.npm-init.js","PWD":"/home/node","npm_execpath":"/usr/local/lib/node_modules/npm/bin/npm-cli.js","KOYEB_INSTANCE_MEMORY_MB":"256","npm_config_global_prefix":"/usr/local","KOYEB_INSTANCE_TYPE":"nano","npm_command":"run-script","INIT_CWD":"/home/node","EDITOR":"vi"}

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
