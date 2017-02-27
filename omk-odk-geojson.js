//file: osm-osmtogeojson.js
//coder: Max Grossman
//purpose: grab .osm files attached to omk submissions and spatialize submissions

// node modules //
var async = require('async')
var DOMParser = require('xmldom').DOMParser;
var fs = require('fs');
var extend = require('extend');
var geojsonMerge = require('geojson-merge');
var oag = require('osm-and-geojson');
var request = require('request');
var rewind = require('geojson-rewind')
var settings = require('./settings.js');
var stringify = require('json-stringify');

// GET submissions json for projectName with omk api //

//name of project to get submissions json for
//TODO: eventually make this populate via user selection on omk?
var projectName = 'colombia_buildings';
//folder to write file to
var userFolder = "/Users/giscomputerextra2/Desktop/max/github/americanredcross/omk-odk-geojson/"
//name for output geoJSON
var outputGeoJSON = userFolder + projectName + '.geojson'
//JSON returned from call to omkserver endpoint in fetchSurvey
var projectJSON = '';
var subGeoJSONs = {};

//get omk submission w/request for projectName & save to projectName
var fetchSurveyGeo = function(projectName) {
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
  console.log('making geoJSONs!')
  for(i=0; i < projectJSON.length; i++ ) {
    //object holding geosjsons and instanceId for each submission
    osmFile = null;
    osmFileList = []
    osmFilesProps = {}
    instanceId = projectJSON[i].meta.instanceId
    instanceId = instanceId.split("uuid:")[1]
    var projectJSONobj = projectJSON[i]
    getSurveyOSMsProps(projectJSONobj)
    if(osmFilesProps.osmProps[0]) {
      //some console.loging to make loop working.
      fetchSurveyOSM(osmFilesProps,projectName,instanceId)
      console.log('Just converted the ' + i = 'th submission!')
    }
  }
}

var writeGeoJSON = function(subGeoJSONs) {
  var projectGeoJSON = geojsonMerge(Object.values(subGeoJSONs))
  //make geojson right-hand compliant
  projectGeoJSON = rewind(projectGeoJSON,false)
  //stringify the geojson so it can be written to a file
  projectGeoJSON = stringify(projectGeoJSON)
  //write merged geoJSON to a file!
  fs.writeFile(outputGeoJSON, projectGeoJSON, (err) => {
  if (err) throw err;
    console.log('It\'s saved!');
  });
}

//TODO: test with a bunch of different surveys and also try and make the projectNANE dynamic
//FIXME: async.waterfall runs, writing out a GeoJSON, but does throws an error
//return survey GeoJSON

async.waterfall([
  fetchSurveyGeo(projectName),
  surveyOSMtoGeoJSON(projectJSON),
  writeGeoJSON(subGeoJSONs)
], function (err, result) {
})
