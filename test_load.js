const 
   { await_page_load
   , delay_for
   , delay_after
   , mandatory_wait
   , mk_is_page_loaded
   , retry_after_fail
   , wait_until
   } = require('./dom-utils.js');
const es = require("eventsource");
const sx = require('./schematix.js');
const _ = require('./node_modules/lodash');
const fs = require('fs');
let fetch_code;
const { ProxyAgent } = require('undici');
const proxy_agent = new ProxyAgent('http://127.0.0.1:5000')
const assert = require("assert");

const jsdom = require('jsdom');
const { JSDOM, ResourceLoader, VirtualConsole } = jsdom;
//const resources = new ResourceLoader({ usable: true, proxy: "http://127.0.0.1:5000" });
const resources = new ResourceLoader({ usable: true});
const OBJECT_TYPE_BUS_SUCCESS_FACTOR = 'bus.success_factor';
const RELATION_TYPE_THEN = 'then';
const RELATION_TYPE_INTEGRATES = 'integrates';
const RELATION_TYPE_DEP = 'depends';
const ATTR_NAME_TYPE = 'type';
const ATTR_NAME_URL = 'url';
const ATTR_NAME_XPATH = 'xpath';
const ATTR_NAME_DATA = 'data';
const ATTR_NAME_CLICK = 'click';
const BUSINESS_STEP_PREFIX = 'bus.step.';

let exported =
	{ get_next_object	: get_next_object
	, is_step		: is_step
	, process_journey_xml	: process_journey_xml
	, graph			: {}
	, run_steps		: run_steps
	, set_fetch_code	: (x) => fetch_code = x
	};
module.exports = exported;

function node (node_oid) { return exported.graph[node_oid]; }
function root_oid () { return exported.root_oid; }

async function run_steps (site, parms, request_id, log_stream_id) {
  console.log(`run steps ${request_id}`);
  let resolve_result	= null;
  let reject_result	= null;
  let result		= new Promise((resolve, reject) => { resolve_result = resolve; reject_result = reject });
  let event_promises	= {};
  let event_data	= {};
  let vConsoles		= [];
  let event_log		= [];
  let globals		= {}
  let dom		= new JSDOM(`<!DOCTYPE html>hello`); // DOM for setitng global values.
  await await_page_load(dom);
  let globals_context = mk_journey_context({dom, globals}); // Context for setting global values.
  _.assign(globals, parms);
  let sub_journeys = [];
  _.each(node(root_oid()).relps.then, oid => { 
    let browse_object = node(oid);
    let number_instances = select_number(browse_object.attrs.number_instances, 1, globals_context);
    for (let i = 0; i < number_instances; i++) {
      sub_journeys.push(start_journey({site, browse_object, journey_number: sub_journeys.length, globals, event_data, event_promises, vConsoles, request_id, log_stream_id, event_log}));
      }
    });
  Promise.all(sub_journeys)
  .then( () => resolve_result(event_log))
  .catch( (err) => { console.log(`77777777777 error in run_steps`); reject_result(err) });
  return result;
  }
function jsdom_options (resources, virtualConsole, journey_context) {
  let result = 
    { referrer: "https://example.com/"
    , includeNodeLocations: true
    , storageQuota: 10000000
    , runScripts: "dangerously"
    , resources: resources
    , includeNodeLocations: true
    , features: { FetchExternalResources : ['img', 'script'], ProcessExternalResources : ['script'] }
    , beforeParse: function (window) { 
        window.eval(fetch_code); // Add fetch.
        class ArgElt extends window.HTMLElement { constructor() { super(); } }; window.customElements.define("run-arg"		, ArgElt); // Define arg element
        class VarElt extends window.HTMLElement { constructor() { super(); } }; window.customElements.define("run-var"		, VarElt); // Define var element
        class ExtElt extends window.HTMLElement { constructor() { super(); } }; window.customElements.define("external-event"	, ExtElt); // Define external event element
        window.AudioContext = Object; // Mock AudioContext.
        window.suppress_navigation_for_testing = true;
        window.suppress_sound_for_testing = true;
        window.suppress_annimations_for_testing = true;
        window.suppress_faro_for_testing = true;
        window.Element.prototype.scrollBy = () => {};
        }
    , virtualConsole	: virtualConsole
    };
  return result;
  }
function mk_external_promise(label = null) {
  let resolver = undefined;
  let rejector = undefined;
  let promise = new Promise(function(resolve, reject) { resolver = resolve; rejector = reject; });
  let result = 
    { promise	: promise
    , resolve	: (data)	=> { if (label != null) console.log(`!!!!!!!!!!!!! journey ${label} resolved`); resolver(data); }
    , reject	: (error)	=> { if (label != null) console.log(`!!!!!!!!!!!!! journey ${label} rejected`); rejector(error); }
    }
  return result;
  }
function first_relp (relp) { return exported.graph[relp[0]]; }
function navigate_away(verb, path, journey_context) {
  let session_pairs = _.toPairs(journey_context.window_f().sessionStorage);
  console.log(`navigate_away ${verb} ${path} journey ${journey_context.journey_number} ${JSON.stringify(journey_context.window_f().sessionStorage)} ${JSON.stringify(session_pairs)}`);
  journey_context.step_xpromise = mk_external_promise(); // Hold up the next step until step navigation is complete.
  let replace_dom = async (text, target_url) => {
        // Clean up the previous dom.
        journey_context.dom_xpromise.resolve(); 
        // Start the new dom as a result of the navigation.
        const dom = new JSDOM(text, _.assign({ url: target_url }, jsdom_options(journey_context.resources, journey_context.virtualConsole, journey_context)));
        journey_context.dirty = true;
        _.each(session_pairs, pair => dom.window.sessionStorage.setItem(pair[0], pair[1])); // Transfer the contents of the session storage from the previous dom.
        journey_context.dom = dom;

        // Get data from loaded page.
        await await_page_load(dom);
        await mandatory_wait(() => dom.window.testing_flags, 60000, `mysteriously missing testing flags`); 
        dom.window.my_alert = (message) => { journey_context.journey_xpromise.reject(message); } // Fail with this message.
        dom.window.testing_flags.suppress_navigation = true;
        dom.window.testing_flags.suppress_sound = true;
        dom.window.testing_flags.suppress_animations = true;
        journey_context.file = dom.window.testing_flags.file;
        //console.log(`journey_context.file ${journey_context.file}`);
        let window_api_object = journey_context.window_f().testing_api;
        if (window_api_object) {
          window_api_object.navigate_away = (verb, path) => navigate_away(verb, path, journey_context);
          window_api_object.my_alert = (message) => { journey_context.journey_xpromise.reject(message); } // Fail with this message.
          window_api_object.my_event_source = es.EventSource;
          } // Create new a new dom when a navigation event occurs.
	else console.warn(`WARNING ${target_url} has no testing API object`);
        await dom.window.eventPromises.functionsAvailablePromise;
	
        // Prepare to clean this dom up on next navigation.
        journey_context.dom_xpromise = mk_external_promise();
        journey_context.dom_xpromise.promise.then(() => {
          dom.window.close();  // Must use the direct dom not the context dom which can change.
          //console.log(`journey_number=${journey_context.dom_xpromise.journey_number} action="window closed"`);
          });
        // Hold up processing until the functions in the loaded page are set up.
        
        journey_context.step_xpromise.resolve();
        //promiseState(journey_context.step_xpromise.promise).then(state => console.log(`step state resolved ${state} ${journey_context.journey_number}`));
    }
  if (verb == "post"){
    let form_id = path;
    let form = journey_context.document_f().getElementById(form_id);
    let formData = new (journey_context.window_f().FormData)(form);
    let body = new URLSearchParams();
    for (const key of formData.keys()) { body.append(key, formData.get(key)); }
    const headers = new Headers();
    headers.append("Content-Type", "application/x-www-form-urlencoded");
    let target_url = journey_context.site + form.getAttribute('action');
    //fetch(target_url, { method: 'POST', body: body, headers: headers, agent: proxy_agent })
    console.log(`${target_url} ${JSON.stringify(body)} ${JSON.stringify(headers)}`);
    fetch(target_url, { method: 'POST', body: body, headers: headers })
      .catch(e => { 
        let err = new Error(`?????????????????????????????????????????????????????????????? could not load ${target_url} due to ${e} journey ${journey_context.journey_number} ${journey_context.request_id} ${journey_context.log_stream_id}`);
        console.error(err);
        journey_context.journey_xpromise.reject(err);
        throw err;
        })
      .then(response => { if (!response.ok) throw new Error(`Response status: ${response.status}`); return response.text(); })
      .then(text => { replace_dom(text, target_url) })
      .catch(e => { 
        console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! could not load ${target_url} due to ${e}`); throw new Error('!!!!!!'); 
        })
      ;
    }
  else if (verb == "get") { 
    let target_url = journey_context.site + path;
    //console.log(`GET ${target_url}`);
    //fetch(target_url, { agent: proxy_agent })
    let f = () => { 
      fetch(target_url, { })
      .catch(e => { 
        let err = new Error(`@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ could not load ${target_url} due to ${e} journey ${journey_context.journey_number} ${journey_context.request_id} ${journey_context.log_stream_id}`); 
        console.error(err);
        journey_context.journey_xpromise.reject(err);
        throw err;
        })
      .then(response => { console.log(`journey ${journey_context.journey_number} got ${target_url} at ${date_f()}`); return response.text(); })
      .then(text => { replace_dom(text, target_url) });
      }
      // FIXME the following code is rubish
    try { f(); } catch (e) { console.log(`11111 failed to get ${target_url}`); console.log(`22222 failed to get ${target_url}`); try { f(); } catch (e) { console.log(`33333 failed to get ${target_url}`); try { f(); } catch (e) { console.log(`4444444 failed to get ${target_url}`); try { f(); } catch (e) { console.log(`55555555 failed to get ${target_url}`); f();  } } } }
    }
  else { throw new Error(`unsuppored verb ${verb}`); }
  }
function mk_journey_context ({dom, journey_number, site, path, resources, virtualConsole, journey_xpromise, globals, event_promises, event_data, vConsoles, request_id, log_stream_id, event_log}) { 
  let o = 
    { dom		: dom
    , site		: site
    , path		: path
    , dom_f		: () => o.dom
    , journey_number	: journey_number
    , window_f		: () => o.dom_f().window
    , document_f	: () => o.window_f().document
    , dom_xpromise	: mk_external_promise()
    , step_xpromise	: mk_external_promise()
    , journey_xpromise	: journey_xpromise
    , vars		: {}
    , session_storage	: '{}'
    , resources		: resources
    , virtualConsole	: virtualConsole
    , dirty		: true
    , last_event	: ""
    , globals		: globals
    , event_promises	: event_promises
    , event_data	: event_data
    , request_id	: request_id
    , log_stream_id	: log_stream_id
    , event_log 	: event_log
    }; 
  // Resolve the step promise - assumed resolved except while navigating.
  o.step_xpromise.resolve();
  return o; 
  }
async function start_journey({ site, browse_object, journey_number, globals, event_promises, event_data, vConsoles, request_id, log_stream_id, event_log }) {
  let journey_xpromise = mk_external_promise(`journey ${journey_number}`);
  assert(browse_object.type == "bus.step.browse_url", "Journeys start with bus.step.browse_url objects");
  let path = first_relp(browse_object.relps.depends).attrs.url;
  let url = site + path;
  let virtualConsole = new VirtualConsole();
  vConsoles.push(virtualConsole);
  virtualConsole.sendTo(
    //{ log	: (...args) => { console.log(`log journey ${journey_number}  ${date_f()}`); console.log(...args)}
    { log	: (...args) => { console.log(`log journey ${journey_number}  ${date_f()}`, ...args)}
    , error	: (...args) => { console.log(`log journey ${journey_number}  ${date_f()}`); console.log(...args)}
    });
  console.log(`navigating to ${url}`);
  JSDOM.fromURL(url, jsdom_options(resources, virtualConsole, {journey_xpromise}))//, { beforeParse(window) { 
    ////console.log(`############# set fetch up.`);
    //window.eval(fetch_code);
    ////retry_after_fail(() => window.eval(fetch_code), 500, 10, "new dom fetch eval"); 
    //}}) // Add fetch.
  .then(async dom => {
    dom.window.EventSource = es.EventSource;
    let navigation_xpromise = mk_external_promise(`journey ${journey_number}`);
    let journey_context = mk_journey_context({dom, journey_number, site, path, resources, virtualConsole, journey_xpromise, globals, event_promises, event_data, request_id, log_stream_id, event_log});
    journey_xpromise = journey_context.journey_xpromise.promise;
    await await_page_load(dom);
    dom.window.my_alert = (message) => { journey_context.journey_xpromise.reject(message); } // Fail with this message.
    //class ArgElt extends dom.window.HTMLElement { constructor() { super(); } }
    //dom.window.customElements.define("run-arg", ArgElt);
    journey_context.file = dom.window.testing_flags.file; 
    //console.log(`loaded ${journey_context.file}`);
    journey_context.window_f().testing_flags.suppress_navigation = true;
    journey_context.window_f().testing_flags.suppress_sound = true;
    journey_context.window_f().testing_flags.suppress_animations = true;
    journey_context.window_f().eventPromises.resolveNavigateAwayPromise = navigation_xpromise.resolve;
    let window_api_object = journey_context.window_f().testing_api;
    if (window_api_object) {
      window_api_object.navigate_away = (verb, path) => navigate_away(verb, path, journey_context); // Create new a new dom when a navigation event occurs.
      window_api_object.my_alert = (message) => journey_context.journey_xpromise.reject(message); // Fail with this message.
      window_api_object.my_event_source = es.EventSource;
      } // Create new a new dom when a navigation event occurs.
    else console.warn(`WARNING ${target_url} has no testing API object`);
    journey_context.window_f().testing_api.navigate_away = (verb, path) => navigate_away(verb, path, journey_context); // Create new a new dom when a navigation event occurs.
    //console.log(`journey_number=${journey_number} url=${url} file=${dom.window.testing_flags.file}`);
    await dom.window.eventPromises.functionsAvailablePromise;
    //console.log(`journey_number=${journey_number} functionsAvailable`);
    journey_context.dom_xpromise.promise.then(() => {
      dom.window.close();
      //console.log(`journey_number=${journey_number} action="window closed"`);
      });
    do_next_step(browse_object, journey_context).catch( error => journey_context.journey_xpromise.reject(error));
    });
  return journey_xpromise.promise;
  }
async function do_next_step(step, journey_context, next_relp = "then") {
  const step_map = 
    { "bus.step.interact"	: do_bus_step_interact
    , "bus.event"		: do_bus_event
    , "bus.step.wait"		: do_bus_step_wait
    , "bus.step.wait_external"	: do_bus_step_wait_external
    , "bus.guard"		: do_bus_guard
    , "bus.step.end_journey"	: do_bus_step_end_journey
    };
  console.log(`journey ${journey_context.journey_number} step ${step.name} completed successfully at ${date_f()}`);
  journey_context.event_log.push([ journey_context.journey_number, step.name, date_f()]);
  let relp = step.relps[next_relp];
  assert(relp && relp.length, `no next step for relationship ${next_relp} of step ${step.name}`);
  assert(relp.length != 0, `no next step for relationship ${next_relp} of step ${step.name}`);
  assert(relp.length == 1, `too many next steps for relationship ${next_relp} of step ${step.name}`);
  let next_step = first_relp(relp);
  if (_.has(next_step.attrs, "abort")) {
    console.log(`aborting at step ${next_step.name}`)
    await do_bus_step_end_journey(next_step, journey_context);
    }
  else {
    let next_step_fn = step_map[next_step.type]
    assert(next_step_fn, `no function for ${next_step.type}`);
    console.log(`journey ${journey_context.journey_number} step ${next_step.name} initiated at ${date_f()}`);
    journey_context.step_xpromise.promise
    .then( () => next_step_fn(next_step, journey_context))
    .catch( error => journey_context.journey_xpromise.reject(error));
    }
  }
async function do_bus_guard(step, journey_context) { 
  assert(step.relps.then.length, "no next step for bus.guard ${step.name}");
  assert(step.relps["then.otherwise"].length, "no next.otherwise step for bus.guard ${step.name}");
  assert(step.attrs.condition, `condition required for bus.guard ${step.name}`);
  insert_data(journey_context);
  let result = dom_bool(journey_context.dom_f(),`boolean(${step.attrs.condition})`, journey_context); 
  let next_relp = result ? "then" : "then.otherwise";
  //console.log(`guard result is ${next_relp} for step ${step.name} journey ${journey_context.journey_number}`);
  do_next_step(step, journey_context, next_relp).catch( error => journey_context.journey_xpromise.reject(error));
  }
async function do_empty_step(step, journey_context) {
  do_next_step(step, journey_context).catch( error => journey_context.journey_xpromise.reject(error));
  }
async function do_bus_step_end_journey(step, journey_context) {
  journey_context.dom_xpromise.resolve();
  journey_context.journey_xpromise.resolve();
  console.log(`journey ended with step ${step.name} of journey ${journey_context.journey_number}`);
  }
async function do_bus_step_interact(step, journey_context) {
  assert(step.attrs.click, `click attribute required for interaction ${step.name}`);
  let count = select_number(step.attrs.count, 1, journey_context);
  let element = null;
  let debug = null;
  if (step.attrs.setvar) {
    let name_and_expression = step.attrs.setvar.split(/=(.*)/);
    let name = name_and_expression[0].trim();
    let expression = name_and_expression[1];
    //console.log(`setting ${name} to ${expression}`);
    journey_context.vars[name] = dom_string(journey_context.dom_f(), expression, journey_context);
    journey_context.dirty = true;
    echo(journey_context, step, step.attrs.echo);
    }
  let click_fn = async () => {
    await await_dom_elt(step.attrs.click, journey_context, 3000, `could not find ${step.name} journey ${journey_context.journey_number} click element `);
    let document = journey_context.document_f();
    element = document.evaluate(step.attrs.click, document, null, journey_context.window_f().XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (!element) console.log(`step ${step.name} journey ${journey_context.journey_number} dom ${journey_context.dom_f().serialize()}`);
    //console.log(`journey_context.window_f().XPathResult.FIRST_ORDERED_NODE_TYPE ${journey_context.window_f().XPathResult.FIRST_ORDERED_NODE_TYPE}`);
    //console.log(`step.attrs.click ${step.attrs.click}`);
    //console.log(`journey_context.file ${journey_context.file}`);
    console.log(`clicking ${step.attrs.click} of ${journey_context.file} from ${journey_context.path} for step ${step.name} journey ${journey_context.journey_number}`)
    
    //console.log(`before click ${JSON.stringify(journey_context.step_xpromise.promise)}`);
    //promiseState(journey_context.step_xpromise.promise).then(state => console.log(state)); 
    element.click();
    //console.log(`after click ${JSON.stringify(journey_context.step_xpromise.promise)}`);
    //promiseState(journey_context.step_xpromise.promise).then(state => console.log(state)); 
    }
  let last_action_promise = Promise.resolve();
  for (let i = 0; i < count; i ++) { 
    insert_data(journey_context);
    if (step.attrs.echo) echo(journey_context, step, step.attrs.echo);
    console.log(`action ${i+1} of ${count} for step ${step.name} journey ${journey_context.journey_number}`);
    last_action_promise = last_action_promise.then(() => delay_after(click_fn, 100)); 
    }
  last_action_promise.then(() => {
    if (step.attrs.enter) { 
      insert_data(journey_context);
      element.value = dom_string(journey_context.dom_f(), step.attrs.enter, journey_context); // Enter string value of the xpath.
      //console.log(`about the enter ${element.value} with type ${typeof element.value}`);
      var event = new (journey_context.window_f().KeyboardEvent)("keyup"); // Fire any keyup events.
      element.dispatchEvent(event);
      }
    do_next_step(step, journey_context).catch( error => journey_context.journey_xpromise.reject(error)); 
    });
  }
async function await_dom_elt(xpath, journey_context, timeout, error_message, debug) { 
  return await mandatory_wait(() => dom_elt(journey_context.dom_f(), xpath, journey_context), timeout, error_message, null, debug); 
  }
function date_f() { return (new Date()).toString().substring(0, 24); }  
async function do_bus_step_wait(step, journey_context) {
  assert((step.attrs.condition || step.attrs.event) && ((!step.attrs.condition) || (!step.attrs.event)), `condition XOR event required for bus.step.wait ${step.name}`);
  assert(step.attrs.timeout && step.attrs.timeout != NaN, `timeout required for bus.step.wait step ${step.name} journey ${journey_context.journey_number}`);
  let timeout = parseInt(step.attrs.timeout);
  if (step.attrs.echo && false) {
    echo(journey_context, step, step.attrs.echo);
    }
  if (step.attrs.echo) echo(journey_context, step, step.attrs.echo);
  if (step.attrs.condition) {
    let xpath = `(${step.attrs.condition})`;
    if (step.attrs["condition.1"]) {
      xpath = `${xpath} or (${step.attrs["condition.1"]})`
    }
    if (step.attrs["condition.2"]) {
      xpath = `${xpath} or (${step.attrs["condition.2"]})`
    }
    if (step.attrs["condition.3"]) {
      xpath = `${xpath} or (${step.attrs["condition.3"]})`
    }
    if (step.attrs["condition.4"]) throw new Error('not implemented');
    console.log(`waiting for ${xpath} for step ${step.name} of journey ${journey_context.journey_number} at ${date_f()}`);
    // FIXME we need to update the data before each attempt - probably means only inserting if we need to :(
    //console.log(`data insertion started ${xpath} for step ${step.name} journey ${journey_context.journey_number} at ${date_f()}`);
    insert_data(journey_context);
    //console.log(`data insertion completed ${xpath} for step ${step.name} journey ${journey_context.journey_number} at ${date_f()}`);
    let start = new Date();
    await mandatory_wait(() => dom_bool(journey_context.dom_f(), xpath, journey_context), timeout, 
        `wait condition timed out for step ${step.name} journey ${journey_context.journey_number} at ${date_f()} ${journey_context.request_id} ${journey_context.log_stream_id}`,
        () => { console.log(`request ${journey_context.request_id} step ${step.name} journey ${journey_context.journey_number} started at ${start.toString().substring(0, 24)} and timed out after ${timeout} at ${date_f()}  ${journey_context.dom_f().serialize()} ${journey_context.log_stream_id}`) });//debug code
    console.log(`wait fulfilled for ${xpath} for step ${step.name} journey ${journey_context.journey_number} at ${date_f()}`);
    if (step.attrs.echo) echo(journey_context, step, step.attrs.echo);
    if (step.attrs.dump == "Y") console.log(`dumping ${step.name} journey ${journey_context.journey_number} ${journey_context.dom_f().serialize()}`);
    }
  else { // event
    let timeout_start = new Date();
    let promiseName = step.attrs.event + "Promise";
    await mandatory_wait(
        () => journey_context.window_f().eventPromises.hasOwnProperty(promiseName), 
        timeout,
        `could not find ${promiseName} for journey ${journey_context.journey_number} step ${step.name}`,
        () => console.log(`promises ${JSON.stringify(journey_context.window_f().eventPromises)} file ${journey_context.file} result ${journey_context.window_f().eventPromises[promiseName]}`),
        );
    let promise = journey_context.window_f().eventPromises[promiseName];
    //console.log("promises", JSON.stringify(journey_context.window_f().eventPromises));
    // FIXME time the promise out using the remainder of the time.
    assert(promise, `no promise found named ${promiseName}`);
    console.log(`journey ${journey_context.journey_number} step ${step.name} waiting for promise ${promiseName}`);
    await promise;
    journey_context.last_event = step.attrs.event;
    console.log(`journey ${journey_context.journey_number} step ${step.name} promise ${promiseName} resolved`);
    }
  if (step.attrs.setvar) {
    let name_and_expression = step.attrs.setvar.split(/=(.*)/);
    let name = name_and_expression[0].trim();
    let expression = name_and_expression[1];
    //console.log(`setting ${name} to ${expression}`);
    journey_context.vars[name] = dom_string(journey_context.dom_f(), expression, journey_context);
    journey_context.dirty = true;
    echo(journey_context, step, step.attrs.echo);
    }
  if (step.attrs.echo) {
    //console.log(`echoing ${step.attrs.echo}`);
    insert_data(journey_context);
    echo(journey_context, step, step.attrs.echo);
    }
  do_next_step(step, journey_context).catch( error => journey_context.journey_xpromise.reject(error));
  }
async function do_bus_event(step, journey_context) { 
  console.log(`creating business event ${step.name} ${journey_context.journey_number} at ${date_f()}`)
  assert((!step.attrs.data ^ !step.attrs.count), "must specify data OR count");
  let event_data;
  if (step.attrs.data) {
    insert_data(journey_context);
    event_data = dom_string(journey_context.dom_f(), step.attrs.data, journey_context);
    console.log(`journey ${journey_context.journey_number} step ${step.name} has event data ${event_data} at ${date_f()}`)
    resolveEventPromise(step.name, journey_context, event_data);  // Resolve immediately.
    } 
  else {
    let count = select_number(step.attrs.count, 1, journey_context);
    resolveEventPromise(step.name, journey_context, 1, (data, agg) => agg ? agg + data : data, agg => agg == count);  // Count the occurences.
    }
  do_next_step(step, journey_context).catch( error => journey_context.journey_xpromise.reject(error));
  }
function resolveEventPromise(name, journey_context, data, aggregator = _.identity, is_complete = () => true) {
  journey_context.event_data[name] = aggregator(data, journey_context.event_data[name]);
  if (!journey_context.event_promises[name]) journey_context.event_promises[name] = mk_external_promise();
  if (is_complete(journey_context.event_data[name]))  {
    console.log(`resolved business event ${name} ${journey_context.journey_number} at ${date_f()}`);
    journey_context.event_promises[name].resolve();
    journey_context.dirty = true;
    }
  }
function insert_data(journey_context) {
  if (!journey_context.dirty) return;
  let dom = journey_context.dom_f();
  let html_elt = dom_elt(dom, `/html`, journey_context);
  // Add the arguments to the dom root node.
  // ASSUMPTION: we are never deleting attributes or elements - only setting them.
  _.each(_.toPairs(journey_context.globals), pair => { 
    let name = pair[0];
    let value = pair[1];
    let el = dom_elt(dom, `/html/run-arg[@id='${name}']`, journey_context);
    if (!el) {
      el = dom.window.document.createElement('run-arg');
      el.setAttribute("name", name);
      el.setAttribute("id", name);
      el.appendChild(dom.window.document.createTextNode(value));
      html_elt.appendChild(el);
      }
    else {
      assert(el.childNodes.length == 1, "only one child node for run-arg");
      el.childNodes[0].nodeValue = value;
      }
    });
  // Add the external event values to the root node.
  _.each(_.toPairs(journey_context.event_data), pair => { 
    let name = pair[0];
    let value = pair[1];
    let el = dom_elt(dom, `/html/external-event[@id='${name}']`, journey_context);
    if (!el) {
      el = dom.window.document.createElement('external-event');
      el.setAttribute("name", name);
      el.setAttribute("id", name);
      el.appendChild(dom.window.document.createTextNode(value));
      html_elt.appendChild(el);
      }
    else {
      assert(el.childNodes.length == 1, "only one child node for external-event");
      el.childNodes[0].nodeValue = value;
      }
    });
  // Add the journey vars.
  if (!journey_context) return;
  _.each(_.toPairs(journey_context.vars), pair => { 
    let name = pair[0];
    let value = pair[1];
    let el = dom_elt(dom, `/html/run-var[@id='${name}']`, journey_context);
    if (!el) {
      el = dom.window.document.createElement("run-var");
      el.setAttribute("name", name);
      el.setAttribute("id", name);
      el.appendChild(dom.window.document.createTextNode(value));
      html_elt.appendChild(el);
      }
    else {
      assert(el.childNodes.length == 1, "only one child node for run-var");
      el.childNodes[0].nodeValue = value;
      }
    });
  journey_context.dirty = false;
  }
function new_dom_insert_data(dom, journey_context) {
  // Add the arguments to the dom root node.
  _.each(_.toPairs(journey_context.lobals), pair => { 
    let name = pair[0];
    let value = pair[1];
    let el = dom.createElement("run-arg");
    el.setAttribute("name", name);
    el.setAttribute("id", name);
    el.appendChild(dom.createTextNode(value));
    dom.getElementsByTagName('html')[0].appendChild(el) 
    });
  // Add the external event values to the root node.
  _.each(_.toPairs(journey_context.event_data), pair => { 
    let name = pair[0];
    let value = pair[1];
    let el = dom.createElement("external_event");
    el.setAttribute("name", name);
    el.setAttribute("id", name);
    el.appendChild(dom.createTextNode(value));
    dom.getElementsByTagName('html')[0].appendChild(el) 
    });
  // Add the journey vars.
  if (!journey_context) return;
  _.each(_.toPairs(journey_context.vars), pair => { 
    let name = pair[0];
    let value = pair[1];
    let el = dom.createElement("run-var");
    el.setAttribute("name", name);
    el.setAttribute("id", name);
    el.appendChild(dom.createTextNode(value));
    dom.getElementsByTagName('html')[0].appendChild(el) 
    });
  }
function dom_elt    (dom, xpath, journey_context) { return dom_value(dom, xpath			, dom.window.XPathResult.FIRST_ORDERED_NODE_TYPE, 'singleNodeValue'	, journey_context) }
function dom_bool   (dom, xpath, journey_context) { return dom_value(dom, `boolean(${xpath})`	, dom.window.XPathResult.BOOLEAN_TYPE		, 'booleanValue'	, journey_context) }
function dom_string (dom, xpath, journey_context) { return dom_value(dom, `string(${xpath})`	, dom.window.XPathResult.STRING_TYPE		, 'stringValue'		, journey_context) }
function dom_number (dom, xpath, journey_context) { return dom_value(dom, `number(${xpath})`	, dom.window.XPathResult.NUMBER_TYPE		, 'numberValue'		, journey_context) }

function dom_value(dom, xpath, result_type, member, journey_context) {
  //insert_data(dom, journey_context);
  let result = dom.window.document.evaluate(xpath, dom.window.document, null, result_type, null);
  return result[member];
  }
function select_number(xpath, def_int, journey_context) {
  if (!xpath) return def_int;
  insert_data(journey_context);
  let result = parseInt(dom_number(journey_context.dom_f(), xpath, journey_context));
  return result;
  }
async function do_bus_step_wait_external(step, journey_context) {
  assert(step.relps.depends, "external wait requires a business event dependency");
  assert(step.relps.depends.length != 0, "external wait requires a business event dependency");
  assert(step.relps.depends.length == 1, "external wait requires exactly one business event dependency");
  let dep = first_relp(step.relps.depends);
  assert(dep.type == "bus.event", "business event dependency must be of type bus.event");
  console.log(`waiting for external step ${step.name} ${journey_context.journey_number} to be resolved. at ${date_f()}`);
  getEventPromise(journey_context, dep.name).then(data => {
    console.log(`external step ${step.name} ${journey_context.journey_number} resolved. at ${date_f()}`);
    do_next_step(step, journey_context).catch( error => journey_context.journey_xpromise.reject(error));
     });
  }
function getEventPromise(journey_context, name) {
  if (!journey_context.event_promises[name]) journey_context.event_promises[name] = mk_external_promise();
  return journey_context.event_promises[name].promise
  }
function echo(journey_context, step, xpath_query) {
  // FIXME standardise log output via function
  console.log(`journey_number=${journey_context.journey_number} step=${step.name} file=${journey_context.file} query_result=${dom_string(journey_context.dom_f(), xpath_query, journey_context)}`);
  }
function process_journey_xml(xml) {
  sx.process_xml(xml);
  exported.raw_json = sx.raw_json;
  exported.root_oid = get_root();
  set_graph(exported.root_oid);
  //console.log(JSON.stringify(exported.graph));
  }
function get_root() {
  // Find the object that starts the journey.  It is the only object that is not the target of a relationship.
  let targets = _.map(exported.raw_json.graph.relation, x => sx.relation_target_id(x));
  return sx.relation_source_id(_.find(exported.raw_json.graph.relation, x => !(_.find(targets, y => y == sx.relation_source_id(x)))));
  }
function set_graph(oid) {
  // Transform the schematix format to a more usable graph of objects that mirrors the visual representation.
  if (exported.graph[oid]) return;
  let o = sx.object_with_id(oid);
  let result = { name: sx.object_name(o), type: sx.object_type(o), attrs: sx.all_attrs(o), relps: {} };
  exported.graph[oid] = result;
  _.each(sx.all_relations(o), relp => {
    if (!result.relps[relp.relp_name]) result.relps[relp.relp_name] = [];
    result.relps[relp.relp_name].push(relp.target_oid);
    set_graph(relp.target_oid);
    });
  }
function is_step(obj) {
  let attr = sx.attr_with_name(obj, sx.ATTR_NAME_TYPE);
  let val = sx.attr_value(attr);
  return val.startsWith(BUSINESS_STEP_PREFIX);
  }
function get_next_object(obj) {
  let from_oid = sx.identity(obj);
  exported.next_relation = _.find(exported.raw_json.graph.relation, x => sx.relation_source_id(x) == from_oid && sx.relation_type(x) == RELATION_TYPE_THEN);
  if (exported.next_relation) return sx.object_with_id(sx.relation_target_id(exported.next_relation));
  }
function promiseState(p) {
	  const t = {};
	  return Promise.race([p, t])
	    .then(v => (v === t)? "pending" : "fulfilled", () => "rejected");
}
