const _ = require('lodash');
const x2js = require("x2js");
let x2j = new x2js();

const ATTR_NAME_TYPE = 'type';
const ATTR_NAME_NAME = 'name';

let exported =
	{ ATTR_NAME_TYPE		: ATTR_NAME_TYPE
	, process_xml			: process_xml
	, identity			: identity
	, objects			: objects
	, all_objects_by_relation	: all_objects_by_relation
	, related_objects_with_type	: related_objects_with_type
	, object_by_relation		: object_by_relation
	, object_with_id		: object_with_id
	, object_attr_value		: object_attr_value
	, all_attrs			: all_attrs
	, attr_value			: attr_value
	, attr_with_name		: attr_with_name
	, object_type			: object_type
	, object_name			: object_name
	, all_relations			: all_relations
	, relation_source_id		: relation_source_id
	, relation_target_id		: relation_target_id
	, relation_type			: relation_type
	};
module.exports = exported;

function process_xml(xml) {
  exported.raw_json = x2j.xml2js(xml);
  // Normalise object and relation to arrays since xml2js guesses whether they should be arrays or not.
  if (!Array.isArray(exported.raw_json.graph.object  )) exported.raw_json.graph.object   = [exported.raw_json.graph.object  ];
  if (!Array.isArray(exported.raw_json.graph.relation)) exported.raw_json.graph.relation = [exported.raw_json.graph.relation];
  }

// Schematix handling.
function objects() {
  return exported.raw_json.graph.object;
  }
function identity(entity) {
  return entity._id;
  }
function relation_type(rel) {
  return rel.a.__text;
  }
function relation_source_id(rel) {
  return rel._source;
  }
function relation_target_id(rel) {
  return rel._target;
  }
function object_by_relation(o, rel_name) {
  let source_oid = identity(o);
  let target = null; // Was an array but the push did not work. Maybe a REPL bug?
  _.each(exported.raw_json.graph.relation, (rel) => { 
    if (rel._source == source_oid && rel.a.__text == rel_name) {
      if (target != null) throw new Error(`too many ${rel_name} relations on ${source_oid}`);
      target = rel._target; 
      //console.log(`found it ${rel._target} ${target}`);
      }
    //else console.log(`${rel._source}!=${source_oid} or ${rel.a.__text}!=${rel_name}`)
    });
  if (target == null) throw new Error(`no ${rel_name} relations on ${source_oid}`);
  return object_with_id(target)
  }
function all_relations(o) {
  let source_oid = identity(o);
  let filtered = _.filter(exported.raw_json.graph.relation, (rel) => {
    return rel._source == source_oid;
    });
  let mapped = _.map(filtered, rel => ({ relp_name: rel.a.__text, target_oid: rel._target}));
  //console.log(mapped);
  return mapped;
  }
function all_objects_by_relation(o, rel_name) {
  let source_oid = identity(o);
  let filtered = _.filter(exported.raw_json.graph.relation, (rel) => {
    return rel._source == source_oid && rel.a.__text == rel_name;
    });
  let mapped = _.map(filtered, rel => object_with_id(rel._target));
  //console.log(mapped);
  return mapped;
  }
function related_objects_with_type(o, r, o_type) {
  let related_objects = all_objects_by_relation(o, r);
  let result = _.filter(related_objects, obj => o_type === object_type(obj));
  return result;
  }
function object_with_id(id) {
  return _.find(exported.raw_json.graph.object, o => o._id == id);
  }
function object_attr_value(o, a) {
  let attr = attr_with_name(o, a);
  if (attr === undefined) throw new Error(`object ${o._id} has no attribute ${a}`);
  return attr_value(attr);
  }
function attr_value(attr) {
  return attr.__text;
  }
function all_attrs(o) {
  let attrs = {}
  _.each(o.a, attr => attrs[attr._name] = attr.__text);
  return attrs;
  }
function attr_with_name(o, attr) {
  return _.find(o.a, a => a._name == attr);
  }
function object_type(o) {
  return attr_value(attr_with_name(o, ATTR_NAME_TYPE));
  }
function object_name(o) {
  return attr_value(attr_with_name(o, ATTR_NAME_NAME));
  }

