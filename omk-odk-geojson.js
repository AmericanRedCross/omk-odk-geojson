//file: osm-osmtogeojson.js
//coder: Max Grossman
//purpose: grab .osm files attached to omk submissions and spatialize submissions

// node modules //
var DOMParser = require('xmldom').DOMParser;
var fs = require('fs');
var extend = require('extend');
var geojsonMerge = require('geojson-merge');
var oag = require('osm-and-geojson');
var request = require('request');
var settings = require('./settings.js');
var sizeOf = require('object-sizeof');
var stringify = require('json-stringify')

// GET submissions json for projectName with omk api //

//name of project to get submissions json for
TODO: eventually make this populate via user selection on omk?
var projectName = 'colombia_buildings';
//JSON returned from call to omkserver endpoint in fetchSurvey
var projectJSON = '';
//osm XML string from call to omkserver endpoint in fetchSurveyOSM
var subOSM = '';
//object holding geosjsons and instanceId for each submission
var subGeoJSONs = {};

//get omk submission w/request for projectName & save to projectName
var fetchSurvey = function(projectName) {
  request({
    method: 'GET',
    'auth': {
      'user': settings.app.user,
      'pass': settings.app.pass
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

//parse projectJSON, return all .osm files and object properties
var getSurveyOSMsProps = function(projectJSONobj) {
  for(var prop in projectJSONobj) {
    if(projectJSONobj.hasOwnProperty(prop)){
      var currentValue = projectJSONobj[prop]
      //if currentValue is an obj, 'go deep' ~ reqeat getSubOSMsProps
      if(typeof currentValue === 'object') {
        getSurveyOSMsProps(currentValue)
      }
      else {
        //when anything else, make it a string, see if it is .osm
        currentValue = currentValue.toString()
        if(currentValue.slice(-4).toLowerCase() === '.osm') {
          //when the osm file, set osmFile equal to it
          osmFile = currentValue;
          osmFileList.push(osmFile)
        }
      }
    }
  }
  osmFilesProps = {osmProps: [osmFileList,projectJSONobj]}
}

//get osm file from omk submission, and return osm file as geojson

//make it so it unpacks all osm files in the submission.
var fetchSurveyOSM = function(osmFilesProps,projectName,instanceId) {
  for(j=0; j < osmFilesProps.osmProps[0].length; j++ ) {
    osm = osmFilesProps.osmProps[0][j]
    request({
      method: 'GET',
      'auth': {
        'user': settings.app.user,
        'pass': settings.app.pass
      },
      uri: 'http://omkserver.com/omk/data/submissions/' +
            projectName + '/' + instanceId + '/' + osm
    },
    function(error, response, body) {
      // when no errors occur, save json to subGeoJSON
      if(!error && response.statusCode == 200) {
        subOSM = body
        subGeoJSONs[instanceId] = oag.osm2geojson(subOSM)
        extend(subGeoJSONs[instanceId].features[0].properties,osmFilesProps.osmProps[1])
      }
    })
  }
}

// convert sub osms to geojson, put each sub's object into geojson properties //
var surveyOSMtoGeoJSON = function(projectJSON) {
  //iterate over objects, if contains osm, convert to / add props to geojson
  for(i=0; i < projectJSON.length; i++ ) {
    osmFile = null;
    osmFileList = []
    osmFilesProps = {}
    instanceId = projectJSON[i].meta.instanceId
    instanceId = instanceId.split("uuid:")[1]
    var projectJSONobj = projectJSON[i]
    getSurveyOSMsProps(projectJSONobj)
    console.log(i)
    if(osmFilesProps.osmProps[0]) {
      //some console.loging to make loop working.
      console.log('making geoJSONs!')
      fetchSurveyOSM(osmFilesProps,projectName,instanceId)
      console.log('we are on ' + i)
    }
  }
}

TODO: finish merge/write geojson
TODO: make sure both .osm and csv (here json) properties are in the new geojson
TODO: test with a bunch of different surveys and also try and make the projectNANE dynamic
// write survey geojson. If more than 1 sub, use geojson-merge then write it out
var writeSurveyGeoJSON = function(subGeoJSONs) {
  projectGeoJSON = geojsonMerge(Object.values(subGeoJSONs))
}

fetchSurvey(projectName)
surveyOSMtoGeoJSON(projectJSON)
//geojson object holding all data in projectJSON
var projectGeoJSON = geojsonMerge(Object.values(subGeoJSONs))
projectGeoJSON = stringify(projectGeoJSON)

fs.writeFile("/Users/giscomputerextra2/Desktop/max/github/americanredcross/omk-odk-geojson/columbia-buildings.geojson", projectGeoJSON, (err) => {
  if (err) throw err;
  console.log('It\'s saved!');
});
