const _ = require("lodash");

module.exports =
  { await_element	
  , await_page_load	
  , delay_for		
  , delay_after		
  , retry_after_fail	
  , mandatory_wait	
  , mk_is_page_loaded	
  , wait_until		
  };

function mk_is_page_loaded(dom) { 
  //console.log(dom.window.document.readyState);
  return () => dom.window.document.readyState == 'complete';
  }

async function retry_after_fail(fn, wait_interval, attempts, tag) {
  try {
    let result = await fn();
    return result;
    }
  catch (e) {
    if (!attempts) throw new Error(`no attempts left for ${tag}`);
    setTimeout(() => retry_after_fail(fn, wait_interval, attempts - 1, tag), wait_interval);
    }
  await fn();
  return new Promise(resolve => setTimeout(resolve, wait_interval));
  }
async function delay_after(fn, wait_interval = 0) {
  await fn();
  return new Promise(resolve => setTimeout(resolve, wait_interval));
  }
async function delay_for(wait_interval) {
  return new Promise(resolve => setTimeout(resolve, wait_interval));
  }
async function wait_until (f, delay, problem_child) {
  var result = f();
  if (problem_child) console.log(`wait_until f() ${result} delay ${delay}`);
  if (result) return result;
  if (problem_child) console.log(`wait_until did not return first result`);

  const start = new Date();
  const wait_interval = 500; // milliseconds
  while (true) {
    if (problem_child) console.log(`wait_until wait for delay...`);
    await delay_for(wait_interval);
    result = f();
    if (problem_child) console.log(`wait_until f() ${result} after wait inteval ${wait_interval}`);
    if (result) return result;
    if (problem_child) console.log(`wait_until did not return delayed result`);
    if (((new Date()) - start) > delay) return false;  // Just in case not an integer.
    }
  }
// FIXME if f() returns a promise we have trouble.
async function mandatory_wait (f, delay, error, debug, problem_child) {
  if (problem_child) console.log(`mandatory_wait problem_child`, f, delay, error);
  let result = await wait_until(f, delay, problem_child);
  if (problem_child) console.log(`mandatory_wait result was${JSON.stringify(result)}`);
  if (!result) {
    if (debug) debug();
    throw new Error(error);
    } 
  return result;
  }
async function await_page_load(dom) {
  await new Promise(resolve => {
    dom.window.document.addEventListener('load', () => {
      //console.log('load event listener fired');
      resolve();
      });
    });
  }
async function await_element(dom, xpath, msg, condition_fn, wait) {
  if (wait === undefined) wait = 3000;
  // Wait for the element to exist.
  let element = await mandatory_wait(() => dom.window.document.evaluate(xpath, dom.window.document, null, dom.window.XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue, 3000, msg);
  // If there is no element we were just waiting for the element to exist so return it.
  if (!condition_fn) return element;
  // Wait for the condition WRT the element to be true;
  await mandatory_wait(() => condition_fn(element), wait, msg);
  return element;
  }
