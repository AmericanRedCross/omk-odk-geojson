//file: osm-osmtogeojson.js
//coder: Max Grossman
//purpose: grab .osm files attached to omk submissions and spatialize submissions

var settings = require('./settings.js');
// node modules //
var request = require('request');
var oag = require('osm-and-geojson');
var extend = require('extend')
var DOMParser = require('xmldom').DOMParser
var geojsonMerge = require('geojson-merge')

// GET submissions json for projectName with omk api //

//name of project to get submissions json for
var projectName = 'colombia_buildings';
//JSON returned from call to omkserver endpoint in fetchSurvey
var projectJSON = '';
//osm XML string from call to omkserver endpoint in fetchSurveyOSM
var subOSM = ''
//geojson made from subOSM, using osm-and-geojson
var subGeoJSON = ''
//list of obj where key = instanceId, val = subGeoJSON
var subGeoJSONs = []
//geojson object holding all data in projectJSON
var projectGeoJSON = ''

//get omk submission w/request for projectName & save to projectName
var fetchSurvey = function(projectName) {
  request({
    method: 'GET',
    'auth': {
      'user': settings.app.usr,
      'pass': settings.app.psw
    },
    uri: 'http://omkserver.com/omk/odk/submissions/' + projectName + '.json'
  },
  function(error, response, body) {
    // when no errors occur, save json to projectJSON
    if(!error && response.statusCode == 200) {
      projectJSON = JSON.parse(body);
    }
  })
}

//get osm file from omk submission, and return osm file as geojson
var fetchSurveyOSM = function(osm,instanceId,projectName,index) {
  request({
    method: 'GET',
    'auth': {
      'user': settings.app.usr,
      'pass': settings.app.psw
    },
    uri: 'http://omkserver.com/omk/data/submissions/' +
          projectName + '/' + instanceId + '/' + osm
  },
  function(error, response, body) {
    // when no errors occur, save json to projectJSON
    if(!error && response.statusCode == 200) {
      subOSM = body
      subGeoJSON = oag.osm2geojson(body)
      extend(subGeoJSON.features[0].properties,projectJSON[index])
    }
  })

}

// convert sub osms to geojson, put each sub's object into geojson properties //
var subOSMtoGeoJSON = function(projectJSON) {
  //iterate over objects, if contains osm, convert to / add props to geojson
  for(i=0; i < projectJSON.length; i++ ) {
    instanceId = projectJSON[i].meta.instanceId
    instanceId = instanceId.split("uuid:")[1]
    if(projectJSON[i].osm_building) {
      //let 'em know we have an osm file
      console.log('can convert osm file "' + instanceId + '" to GeoJSON at ' + i)
      osmFile = projectJSON[i].osm_building.originalFilename
      fetchSurveyOSM(osmFile,instanceId,projectName,i)
      subGeoJSONs.push(subGeoJSON)
    }
    else {
      //let 'em know we do not have an osm file
      console.log('cannot convert osm file "' + instanceId + '" to GeoJSON at ' + i)
    }
  }
}

fetchSurvey(projectName)
subOSMtoGeoJSON(projectJSON)
//projectGeoJSON = geojsonMerge.mergeFeatureCollectionStream(projectGeoJSONs)
